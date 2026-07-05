import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('recording platform upload closure script keeps the expected regression guards', () => {
  const script = readFileSync('tools/web-ui-runner/recordingPlatformUploadClosure.e2e.mjs', 'utf8');

  assert.match(script, /LOCAL_RUNNER_E2E_FRONTEND_URL/);
  assert.match(script, /runner did not record the fixture upload interaction/);
  assert.match(script, /platform upload save request was not captured/);
  assert.match(script, /platform upload step did not survive page reload/);
  assert.match(script, /platform local runner upload request was not captured/);
  assert.match(script, /artifactRefs/);
  assert.match(script, /uploadArtifactBinding/);
  assert.match(script, /upload-demo\.txt/);
  assert.match(script, /contentBase64/);
  assert.match(script, /page\.reload/);
  assert.match(script, /\/automation\/web\/cases\/\$\{CASE_ID\}\/local-runner-run/);
  assert.match(script, /runner upload replay task did not succeed/);
  assert.match(script, /FIXTURE_RESULT_TEXT = `Uploaded \$\{FIXTURE_FILE_NAME\}`/);
});
