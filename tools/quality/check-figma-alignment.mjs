import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DEFAULT_RECORD = path.join('docs', 'figma-alignment', 'current.json');
const WORKFLOW = [
  'design-static',
  'make-event-inventory',
  'make-preview-validation',
  'vue-implementation',
  'browser-validation',
  'difference-registration',
];
const EVENTS = ['hover', 'focus', 'blur', 'active', 'disabled', 'loading', 'success', 'failure'];
const RECORD_STATUSES = new Set(['draft', 'partial-alignment', 'blocked', 'verified-alignment', 'accepted-with-deviations']);
const DIFFERENCE_STATUSES = new Set(['resolved', 'accepted-deviation', 'unresolved']);

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function displayPath(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function addMissing(missing, condition, message) {
  if (!condition) missing.push(message);
}

function checkList(missing, value, label) {
  addMissing(missing, isNonEmptyArray(value), `${label} must be a non-empty array`);
}

function checkEvidence(missing, value, label) {
  checkList(missing, value, label);
  addMissing(missing, Array.isArray(value) && value.every(isNonEmptyString), `${label} must contain non-empty strings`);
}

function checkFiles(missing, value, label) {
  checkEvidence(missing, value, label);
  for (const file of Array.isArray(value) ? value : []) {
    if (!isNonEmptyString(file)) continue;
    const target = path.resolve(ROOT, file);
    addMissing(missing, fs.existsSync(target) && fs.statSync(target).isFile() && fs.statSync(target).size > 0, `${label}: missing or empty file ${file}`);
  }
}

function indexedEntries(missing, value, key, label) {
  addMissing(missing, Array.isArray(value), `${label} must be an array`);
  const entries = new Map();
  for (const entry of Array.isArray(value) ? value : []) {
    if (!entry || typeof entry !== 'object' || !isNonEmptyString(entry[key])) {
      missing.push(`${label} entries must have a non-empty ${key}`);
      continue;
    }
    addMissing(missing, !entries.has(entry[key]), `${label} has duplicate ${key}: ${entry[key]}`);
    entries.set(entry[key], entry);
  }
  return entries;
}

const recordArgument = getArg('--record') || DEFAULT_RECORD;
const recordPath = path.resolve(ROOT, recordArgument);

if (!fs.existsSync(recordPath)) {
  console.error(`Figma alignment record not found: ${displayPath(recordPath)}`);
  console.error('Create a record from docs/figma-alignment-record.template.json and pass it with --record.');
  process.exit(1);
}

let record;
try {
  record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
} catch (error) {
  console.error(`Invalid JSON in ${displayPath(recordPath)}: ${error.message}`);
  process.exit(1);
}

const missing = [];
addMissing(missing, record && typeof record === 'object' && !Array.isArray(record), 'record must be an object');
if (missing.length === 0) {
  addMissing(missing, isNonEmptyString(record.title), 'title is required');
  addMissing(missing, isNonEmptyString(record.page), 'page is required');
  addMissing(missing, isNonEmptyString(record.status), 'status is required');
  addMissing(missing, RECORD_STATUSES.has(record.status), `status must be one of ${[...RECORD_STATUSES].join(', ')}`);
  addMissing(missing, ['verified-alignment', 'accepted-with-deviations'].includes(record.status), 'delivery requires verified-alignment or accepted-with-deviations; draft, partial-alignment and blocked cannot pass');
  addMissing(missing, record.scope && isNonEmptyArray(record.scope.figmaNodes), 'scope.figmaNodes must be a non-empty array');
  addMissing(missing, record.scope && isNonEmptyString(record.scope.makeCodePath), 'scope.makeCodePath is required');
  addMissing(missing, record.scope && isNonEmptyString(record.scope.makePreviewUrl), 'scope.makePreviewUrl is required');
  addMissing(missing, record.scope && isNonEmptyArray(record.scope.currentCodeFiles), 'scope.currentCodeFiles must be a non-empty array');

  checkFiles(missing, [record.scope?.makeCodePath], 'scope.makeCodePath');
  checkFiles(missing, record.scope?.currentCodeFiles, 'scope.currentCodeFiles');
  const workflow = indexedEntries(missing, record.workflow, 'id', 'workflow');
  for (const id of WORKFLOW) {
    const step = workflow.get(id);
    addMissing(missing, step && step.status === 'verified', `workflow.${id} must be verified`);
    checkEvidence(missing, step?.evidence, `workflow.${id}.evidence`);
  }

  const design = record.evidence?.design;
  checkList(missing, design?.nodes, 'evidence.design.nodes');
  checkFiles(missing, design?.screenshots, 'evidence.design.screenshots');

  const make = record.evidence?.make;
  checkEvidence(missing, make?.codeReferences, 'evidence.make.codeReferences');
  const eventMap = indexedEntries(missing, make?.eventMatrix, 'name', 'evidence.make.eventMatrix');
  for (const eventName of EVENTS) {
    const event = eventMap.get(eventName);
    addMissing(missing, event, `evidence.make.eventMatrix.${eventName} is required`);
    if (event) {
      addMissing(missing, isNonEmptyString(event.status), `event ${eventName} status is required`);
      addMissing(missing, ['verified', 'not-expressed'].includes(event.status), `event ${eventName} must be verified or not-expressed, got ${event.status}`);
      checkEvidence(missing, event.evidence, `event ${eventName}.evidence`);
      if (event.status === 'not-expressed') {
        addMissing(missing, isNonEmptyString(event.rationale), `event ${eventName}.rationale is required for ${event.status}`);
        addMissing(missing, isNonEmptyString(event.resolution), `event ${eventName}.resolution is required for ${event.status}`);
      }
    }
  }

  const preview = record.evidence?.makePreview;
  addMissing(missing, isNonEmptyString(preview?.url), 'evidence.makePreview.url is required');
  checkList(missing, preview?.viewport, 'evidence.makePreview.viewport');
  checkEvidence(missing, preview?.interactions, 'evidence.makePreview.interactions');
  checkFiles(missing, preview?.screenshots, 'evidence.makePreview.screenshots');

  const vue = record.evidence?.vue;
  checkFiles(missing, vue?.screenshots, 'evidence.vue.screenshots');
  checkEvidence(missing, vue?.computedStyle, 'evidence.vue.computedStyle');
  checkEvidence(missing, vue?.boundingBox, 'evidence.vue.boundingBox');
  checkEvidence(missing, vue?.interactionResults, 'evidence.vue.interactionResults');

  const differences = [...indexedEntries(missing, record.differences, 'id', 'differences').values()];
  if (Array.isArray(differences) && differences.length === 0) {
    addMissing(missing, isNonEmptyString(record.noDifferencesReason), 'noDifferencesReason is required when differences is empty');
  }
  for (const [index, difference] of (differences || []).entries()) {
    addMissing(missing, isNonEmptyString(difference.id), `differences[${index}].id is required`);
    addMissing(missing, isNonEmptyString(difference.status), `differences[${index}].status is required`);
    addMissing(missing, DIFFERENCE_STATUSES.has(difference.status), `differences[${index}].status must be one of ${[...DIFFERENCE_STATUSES].join(', ')}`);
    addMissing(missing, isNonEmptyString(difference.area), `differences[${index}].area is required`);
    addMissing(missing, isNonEmptyString(difference.source), `differences[${index}].source is required`);
    addMissing(missing, isNonEmptyString(difference.current), `differences[${index}].current is required`);
    addMissing(missing, isNonEmptyString(difference.resolution), `differences[${index}].resolution is required`);
    addMissing(missing, isNonEmptyString(difference.followUp), `differences[${index}].followUp is required`);
    checkEvidence(missing, difference.evidence, `differences[${index}].evidence`);
    addMissing(missing, isNonEmptyString(difference.decisionBasis), `differences[${index}].decisionBasis is required`);
    addMissing(missing, isNonEmptyString(difference.impact), `differences[${index}].impact is required`);
    addMissing(missing, difference.status !== 'unresolved', `difference ${difference.id} is unresolved`);
    if (difference.status === 'accepted-deviation') {
      addMissing(missing, ['user-decision', 'business-constraint'].includes(difference.acceptance?.type), `difference ${difference.id} acceptance.type must be user-decision or business-constraint`);
      addMissing(missing, isNonEmptyString(difference.acceptance?.reference), `difference ${difference.id} acceptance.reference is required`);
    }
  }

  addMissing(missing, Array.isArray(record.unverifiedStatuses), 'unverifiedStatuses must be an array');
  addMissing(missing, Array.isArray(record.unverifiedStatuses) && record.unverifiedStatuses.length === 0, 'delivery requires unverifiedStatuses to be empty');
  const differenceStatuses = new Set((differences || []).map(difference => difference.status));
  if (record.status === 'verified-alignment') {
    addMissing(missing, differenceStatuses.size === 0 || [...differenceStatuses].every(status => status === 'resolved'), 'verified-alignment cannot contain accepted-deviation or unresolved differences');
  }
  if (record.status === 'accepted-with-deviations') {
    addMissing(missing, !differenceStatuses.has('unresolved'), 'accepted-with-deviations cannot contain unresolved differences');
    addMissing(missing, differenceStatuses.has('accepted-deviation'), 'accepted-with-deviations requires at least one accepted-deviation');
  }
  const commands = record.validation?.commands;
  checkEvidence(missing, commands, 'validation.commands');
  addMissing(missing, Array.isArray(commands) && commands.some(command => /typecheck|build/i.test(command)), 'validation.commands must include typecheck or build');
  addMissing(missing, Array.isArray(commands) && commands.some(command => /diff --check/i.test(command)), 'validation.commands must include git diff --check');
}

if (missing.length > 0) {
  console.error(`Figma alignment check failed for ${displayPath(recordPath)}:`);
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Figma alignment record passed: ${displayPath(recordPath)}`);
console.log('Record constraints and referenced files passed. This does not prove pixel parity or evidence authenticity.');
