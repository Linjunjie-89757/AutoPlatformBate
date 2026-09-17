import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'tools/quality/check-figma-alignment.mjs');

// Synthetic records test the gate, not the actual Auth implementation.
function fixture(screenshot) {
  const record = JSON.parse(fs.readFileSync(path.join(root, 'docs/figma-alignment-record.template.json'), 'utf8'));
  record.status = 'verified-alignment';
  record.scope.makeCodePath = script;
  record.scope.currentCodeFiles = [script];
  for (const step of record.workflow) {
    step.status = 'verified';
    step.evidence = ['Synthetic test evidence'];
  }
  record.evidence.design = { nodes: [{ node: '1:1' }], screenshots: [screenshot] };
  record.evidence.make.codeReferences = ['Synthetic source reference'];
  for (const event of record.evidence.make.eventMatrix) {
    event.status = 'verified';
    event.evidence = ['Synthetic event evidence'];
  }
  record.evidence.makePreview = { url: 'https://www.figma.com/make/test', viewport: [1200, 900], interactions: ['Synthetic interaction'], screenshots: [screenshot] };
  record.evidence.vue = { screenshots: [screenshot], computedStyle: ['width: 100px'], boundingBox: ['100x30'], interactionResults: ['Synthetic result'] };
  record.differences[0].status = 'resolved';
  record.unverifiedStatuses = [];
  return record;
}

function runCase(change, expected, message) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-gate-test-'));
  try {
    const screenshot = path.join(directory, 'synthetic.png');
    fs.writeFileSync(screenshot, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64'));
    const record = fixture(screenshot);
    change(record);
    const recordPath = path.join(directory, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(record));
    const result = spawnSync(process.execPath, [script, '--record', recordPath], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, expected, result.stdout + result.stderr);
    assert.doesNotMatch(result.stderr, /TypeError|ReferenceError/);
    if (message) assert.match(result.stdout + result.stderr, message);
  } finally {
    // Only remove the exact unique directory created by this test.
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('figma-gate-test-'));
    fs.rmSync(directory, { recursive: true });
  }
}

test('complete synthetic record passes without claiming pixel parity', () => runCase(() => {}, 0, /does not prove pixel parity/));
for (const status of ['draft', 'partial-alignment', 'blocked']) {
  test(`${status} cannot pass delivery`, () => runCase(r => { r.status = status; }, 1, /delivery requires/));
}
for (const status of ['unverified', 'blocked', 'failed', 'not-provided', 'typo']) {
  test(`event ${status} cannot bypass delivery`, () => runCase(r => { r.evidence.make.eventMatrix[0].status = status; }, 1, /event hover must be/));
}
test('not-expressed with rationale and decision does not itself block', () => runCase(r => {
  Object.assign(r.evidence.make.eventMatrix[0], { status: 'not-expressed', rationale: 'Synthetic source and preview show no variant', resolution: 'Synthetic Vue behavior matches' });
}, 0));
test('not-expressed without rationale is rejected', () => runCase(r => { r.evidence.make.eventMatrix[0].status = 'not-expressed'; }, 1, /rationale/));
test('unresolved differences are rejected', () => runCase(r => { r.differences[0].status = 'unresolved'; }, 1, /is unresolved/));
test('unverified items are rejected', () => runCase(r => { r.unverifiedStatuses = ['focus pending']; }, 1, /unverifiedStatuses/));
test('retained deviation cannot be called verified-alignment', () => runCase(r => { r.differences[0].status = 'accepted-deviation'; }, 1, /cannot contain accepted-deviation/));
test('accepted deviation requires traceable acceptance', () => runCase(r => { r.status = 'accepted-with-deviations'; r.differences[0].status = 'accepted-deviation'; }, 1, /acceptance.reference/));
test('accepted deviation with reference can pass as accepted, not identical', () => runCase(r => {
  r.status = 'accepted-with-deviations';
  r.differences[0].status = 'accepted-deviation';
  r.differences[0].acceptance = { type: 'user-decision', reference: 'Synthetic user decision for test only' };
}, 0));
test('duplicate event cannot mask an unverified entry', () => runCase(r => { r.evidence.make.eventMatrix.push({ ...r.evidence.make.eventMatrix[0] }); }, 1, /duplicate name/));
test('duplicate difference identifiers are rejected', () => runCase(r => { r.differences.push({ ...r.differences[0] }); }, 1, /duplicate id/));
test('missing screenshot is rejected', () => runCase(r => { r.evidence.vue.screenshots = ['not-existing-gate-test.png']; }, 1, /missing or empty file/));
test('blank evidence cannot pass as a filled array', () => runCase(r => { r.workflow[0].evidence = [' ']; }, 1, /non-empty strings/));
for (const field of ['workflow', 'differences', 'unverifiedStatuses']) {
  test(`malformed ${field} reports a validation error`, () => runCase(r => { r[field] = {}; }, 1, /must be an array/));
}
test('malformed events report a validation error', () => runCase(r => { r.evidence.make.eventMatrix = {}; }, 1, /must be an array/));
test('null difference reports a validation error', () => runCase(r => { r.differences = [null]; }, 1, /entries must have/));
test('malformed commands report a validation error', () => runCase(r => { r.validation.commands = {}; }, 1, /non-empty array/));
