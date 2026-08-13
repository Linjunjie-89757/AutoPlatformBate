import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_ROOTS = ['src', 'tests', 'tools']
export const DEFAULT_EXTENSIONS = ['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs']
export const DEFAULT_SKIP_DIRECTORIES = [
  '.git',
  '.playwright-cli',
  'dist',
  'node_modules',
  'target',
  'test-results',
]
export const DEFAULT_REVIEW_LINES = 1500
export const DEFAULT_REVIEW_KB = 100
export const DEFAULT_CRITICAL_LINES = 3000
export const DEFAULT_CRITICAL_KB = 150

function parseNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

function walkFiles(directory, options, files) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!options.skipDirectories.has(entry.name)) {
        walkFiles(fullPath, options, files)
      }
      continue
    }
    if (!entry.isFile()) continue
    if (!options.extensions.has(path.extname(entry.name))) continue
    files.push(fullPath)
  }
}

export function scanLargeFiles(options = {}) {
  const cwd = options.cwd || process.cwd()
  const roots = options.roots || DEFAULT_ROOTS
  const reviewLines = parseNumber(options.reviewLines, DEFAULT_REVIEW_LINES)
  const reviewKb = parseNumber(options.reviewKb, DEFAULT_REVIEW_KB)
  const criticalLines = parseNumber(options.criticalLines, DEFAULT_CRITICAL_LINES)
  const criticalKb = parseNumber(options.criticalKb, DEFAULT_CRITICAL_KB)
  const scanOptions = {
    extensions: new Set(options.extensions || DEFAULT_EXTENSIONS),
    skipDirectories: new Set(options.skipDirectories || DEFAULT_SKIP_DIRECTORIES),
  }
  const files = []

  for (const root of roots) {
    walkFiles(path.join(cwd, root), scanOptions, files)
  }

  const large = files
    .map((filePath) => {
      const text = fs.readFileSync(filePath, 'utf8')
      const bytes = Buffer.byteLength(text)
      const lines = text.length ? text.split(/\r\n|\n|\r/).length : 0
      const needsReview = lines >= reviewLines || bytes >= reviewKb * 1024
      const critical = lines >= criticalLines || bytes >= criticalKb * 1024
      return {
        path: normalizePath(path.relative(cwd, filePath)),
        lines,
        kb: Number((bytes / 1024).toFixed(1)),
        overLines: lines >= reviewLines,
        overKb: bytes >= reviewKb * 1024,
        needsReview,
        critical,
        severity: critical ? 'critical' : 'review',
      }
    })
    .filter(item => item.needsReview)
    .sort((left, right) => Number(right.critical) - Number(left.critical) || right.lines - left.lines || right.kb - left.kb)

  return {
    scannedFiles: files.length,
    reviewSignal: {
      lines: reviewLines,
      kb: reviewKb,
    },
    criticalSignal: {
      lines: criticalLines,
      kb: criticalKb,
    },
    count: large.length,
    criticalCount: large.filter(item => item.critical).length,
    large,
  }
}

function printReport(report) {
  console.log(`Scanned files: ${report.scannedFiles}`)
  console.log(`Large-file review: >= ${report.reviewSignal.lines} lines OR >= ${report.reviewSignal.kb} KB`)
  console.log(`Critical review: >= ${report.criticalSignal.lines} lines OR >= ${report.criticalSignal.kb} KB`)
  console.log('Size is an advisory signal only. Split files only when doing so improves responsibilities, dependencies, typing, or testability.')
  console.log(`Review candidates: ${report.count} (${report.criticalCount} critical)`)
  for (const item of report.large) {
    console.log(`[${item.severity}]\t${item.path}\t${item.lines} lines\t${item.kb} KB`)
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  const report = scanLargeFiles({
    cwd: process.cwd(),
    reviewLines: process.env.LARGE_FILE_REVIEW_LINES,
    reviewKb: process.env.LARGE_FILE_REVIEW_KB,
    criticalLines: process.env.LARGE_FILE_CRITICAL_LINES,
    criticalKb: process.env.LARGE_FILE_CRITICAL_KB,
  })
  printReport(report)
}
