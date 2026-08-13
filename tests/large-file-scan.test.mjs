import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { scanLargeFiles } from '../tools/quality/scan-large-files.mjs'

test('scanLargeFiles classifies advisory review and critical candidates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'large-file-scan-'))
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'small.ts'), 'export const ok = true\n', 'utf8')
  fs.writeFileSync(path.join(root, 'src', 'large.ts'), Array.from({ length: 4 }, (_, index) => `line${index}`).join('\n'), 'utf8')
  fs.writeFileSync(path.join(root, 'src', 'critical.ts'), Array.from({ length: 8 }, (_, index) => `line${index}`).join('\n'), 'utf8')

  const report = scanLargeFiles({
    cwd: root,
    roots: ['src'],
    reviewLines: 4,
    reviewKb: 1000,
    criticalLines: 8,
    criticalKb: 2000,
  })

  assert.equal(report.scannedFiles, 3)
  assert.equal(report.count, 2)
  assert.equal(report.criticalCount, 1)
  assert.equal(report.large[0].path, 'src/critical.ts')
  assert.equal(report.large[0].severity, 'critical')
  assert.equal(report.large[1].path, 'src/large.ts')
  assert.equal(report.large[1].severity, 'review')
  assert.equal(report.large[1].overLines, true)
})
