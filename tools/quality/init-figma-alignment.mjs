import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

function values(name) {
  const result = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) result.push(process.argv[index + 1]);
  }
  return result;
}

function value(name) {
  return values(name)[0];
}

function fail(message) {
  console.error(`Figma alignment init failed: ${message}`);
  process.exit(1);
}

function requireValue(name) {
  const result = value(name);
  if (!result?.trim()) fail(`${name} is required`);
  return result.trim();
}

function requireValues(name) {
  const result = values(name).map(item => item.trim()).filter(Boolean);
  if (result.length === 0) fail(`${name} is required at least once`);
  return [...new Set(result)];
}

function workspaceFile(file, label) {
  const absolute = path.resolve(ROOT, file);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail(`${label} must stay inside the workspace: ${file}`);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`${label} does not exist: ${file}`);
  return { absolute, relative: relative.replaceAll('\\', '/') };
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const recordArgument = requireValue('--record');
const recordPath = path.resolve(ROOT, recordArgument);
const recordRelative = path.relative(ROOT, recordPath);
if (recordRelative.startsWith('..') || path.isAbsolute(recordRelative)) fail('--record must stay inside the workspace');
if (fs.existsSync(recordPath)) fail(`refusing to overwrite existing record: ${recordRelative.replaceAll('\\', '/')}`);

const makeCode = workspaceFile(requireValue('--make-code'), '--make-code');
const currentCodeFiles = requireValues('--current-code').map(file => workspaceFile(file, '--current-code').relative);
const figmaNodes = requireValues('--figma-node');
const variants = requireValues('--variant');
const elements = requireValues('--element');
const excludedAreas = values('--excluded-area').map(item => item.trim()).filter(Boolean);
const createdAt = new Date().toISOString();
const makeBuffer = fs.readFileSync(makeCode.absolute);
const makeStat = fs.statSync(makeCode.absolute);

const comparisonMatrix = variants.flatMap(variant => elements.map(element => ({
  id: `${variant}::${element}`,
  variant,
  element,
  status: 'unverified',
  design: { target: '', evidence: [] },
  makeSource: { finding: '', evidence: [] },
  makePreview: { operation: '', result: '', evidence: [] },
  vue: { result: '', screenshots: [], computedStyle: [], boundingBox: [], interactionEvidence: [] },
  differenceIds: [],
  rationale: '',
})));

const record = {
  schemaVersion: 2,
  title: requireValue('--title'),
  page: requireValue('--page'),
  status: 'draft',
  createdAt,
  sourceBaseline: {
    gitBranch: git('branch', '--show-current') || 'detached-or-unavailable',
    gitCommit: git('rev-parse', 'HEAD') || 'unavailable',
    designCapturedAt: '',
    makeCode: {
      path: makeCode.relative,
      sha256: crypto.createHash('sha256').update(makeBuffer).digest('hex'),
      modifiedAt: makeStat.mtime.toISOString(),
    },
    makePreviewCapturedAt: '',
    vueCapturedAt: '',
    environment: { viewport: [], devicePixelRatio: null, browserZoom: null, fontStatus: 'unverified' },
  },
  scope: {
    figmaNodes,
    makeCodePath: makeCode.relative,
    makePreviewUrl: requireValue('--make-preview'),
    currentCodeFiles,
    variants,
    elements,
    excludedAreas,
  },
  workflow: [
    { id: 'design-static', status: 'unverified', evidence: [] },
    { id: 'make-event-inventory', status: 'unverified', evidence: [] },
    { id: 'make-preview-validation', status: 'unverified', evidence: [] },
    { id: 'vue-implementation', status: 'unverified', evidence: [] },
    { id: 'browser-validation', status: 'unverified', evidence: [] },
    { id: 'difference-registration', status: 'unverified', evidence: [] },
  ],
  evidence: {
    design: { nodes: [], screenshots: [] },
    make: {
      codeReferences: [],
      eventMatrix: ['hover', 'focus', 'blur', 'active', 'disabled', 'loading', 'success', 'failure'].map(name => ({
        name, status: 'unverified', evidence: [], rationale: '', resolution: '',
      })),
    },
    makePreview: { url: requireValue('--make-preview'), viewport: [], interactions: [], screenshots: [] },
    vue: { screenshots: [], computedStyle: [], boundingBox: [], interactionResults: [] },
  },
  comparisonMatrix,
  differences: [],
  noDifferencesReason: '',
  unverifiedStatuses: ['四方基线和逐项验证尚未完成'],
  validation: {
    commands: ['npm run typecheck', 'npm run build', 'git diff --check'],
    summary: { resolved: 0, acceptedDeviations: 0, unresolved: 0, unverified: comparisonMatrix.length + 1 },
  },
};

fs.mkdirSync(path.dirname(recordPath), { recursive: true });
fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Created Figma alignment draft: ${recordRelative.replaceAll('\\', '/')}`);
console.log(`Matrix items: ${comparisonMatrix.length} (${variants.length} variants × ${elements.length} elements)`);
console.log('Complete the four-source baseline before editing target UI files.');
