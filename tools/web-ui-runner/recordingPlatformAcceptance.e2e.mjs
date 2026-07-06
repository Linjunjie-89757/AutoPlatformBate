import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const RUNNER_BASE_URL = process.env.LOCAL_RUNNER_E2E_RUNNER_URL || 'http://127.0.0.1:39118';

const scenarios = [
  {
    name: 'recording-context',
    script: 'tools/web-ui-runner/recordingPlatformClosure.e2e.mjs',
  },
  {
    name: 'recording-upload-context',
    script: 'tools/web-ui-runner/recordingPlatformUploadClosure.e2e.mjs',
  },
];

async function main() {
  const results = [];
  for (const scenario of scenarios) {
    const startedAt = Date.now();
    const result = await runScenario(scenario);
    results.push({
      name: scenario.name,
      durationMs: Date.now() - startedAt,
      fixtureUrl: result.fixtureUrl,
      savedStepType: result.savedStep?.type || null,
      replayStatus: result.replayResult?.status || null,
      screenshot: result.screenshot || null,
    });
  }

  assert.deepEqual(
    results.map(item => item.replayStatus),
    scenarios.map(() => 'SUCCESS'),
    'all recording acceptance scenarios must replay successfully',
  );

  console.log(JSON.stringify({
    success: true,
    scenarioCount: results.length,
    scenarios: results,
  }, null, 2));
}

async function runScenario(scenario) {
  await resetRunnerState();
  try {
    const output = await runNodeScript(scenario.script);
    const parsed = parseScenarioJson(output.stdout);
    assert.equal(parsed?.success, true, `${scenario.name} did not report success`);
    assert.equal(parsed?.replayResult?.status, 'SUCCESS', `${scenario.name} replay did not succeed`);
    return parsed;
  } finally {
    await resetRunnerState();
  }
}

function runNodeScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', chunk => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${script} exited with ${code}\n${stderr || stdout}`));
    });
  });
}

function parseScenarioJson(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('scenario output did not contain a JSON summary');
  }
  return JSON.parse(stdout.slice(start, end + 1));
}

async function resetRunnerState() {
  await runnerPost('/tasks/poll/stop', {}).catch(() => null);
  await runnerPost('/session/release', {}).catch(() => null);
}

async function runnerPost(path, body) {
  const response = await fetch(`${RUNNER_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return response.json().catch(() => null);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
