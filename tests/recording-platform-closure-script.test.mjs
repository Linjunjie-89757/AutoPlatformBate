import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('recording platform closure script keeps the expected regression guards', () => {
  const script = readFileSync('tools/web-ui-runner/recordingPlatformClosure.e2e.mjs', 'utf8');

  assert.match(script, /LOCAL_RUNNER_E2E_FRONTEND_URL/);
  assert.match(script, /runner did not record the fixture interaction/);
  assert.match(script, /button not found or disabled/);
  assert.match(script, /shadow-button/);
  assert.match(script, /iframe#demo-frame/);
  assert.match(script, /fixture-host/);
  assert.match(script, /savedPayload\?\.steps\?\.\[0\]/);
  assert.match(script, /\/tasks\/poll\/start/);
  assert.match(script, /runner replay task did not succeed/);
  assert.match(script, /Assert playback result/);
  assert.match(script, /clicked shadow-button/);
});
