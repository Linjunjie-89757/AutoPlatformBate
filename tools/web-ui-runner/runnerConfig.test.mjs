import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  DEFAULT_RUNNER_CAPABILITIES,
  RUNNER_VERSION,
  ensureRunnerRuntimeDirectories,
  resolveRunnerRuntimeConfig,
} from './runnerConfig.mjs';

test('resolveRunnerRuntimeConfig builds productized defaults', () => {
  const config = resolveRunnerRuntimeConfig({
    env: {},
    argv: [],
    cwd: 'D:\\project',
    homeDir: 'C:\\Users\\tester',
    hostname: 'qa-machine',
  });

  assert.equal(config.runnerVersion, RUNNER_VERSION);
  assert.equal(config.productName, 'Auto Platform Local Runner');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 39118);
  assert.equal(config.sessionTtlMinutes, 15);
  assert.equal(config.installId, 'web-ui-runner-qa-machine');
  assert.equal(config.runnerName, 'Auto Platform Local Runner');
  assert.equal(config.machineHint.deviceName, 'qa-machine');
  assert.equal(config.dataDir, join('C:\\Users\\tester', '.auto-web-ui-runner'));
  assert.equal(config.authDir, join('C:\\Users\\tester', '.auto-web-ui-runner', 'auth'));
  assert.equal(config.logDir, join('C:\\Users\\tester', '.auto-web-ui-runner', 'logs'));
  assert.equal(config.configPath, join('C:\\Users\\tester', '.auto-web-ui-runner', 'config.json'));
  assert.deepEqual(config.capabilities, DEFAULT_RUNNER_CAPABILITIES);
  assert.equal(config.commands.start, 'npm.cmd run runner');
  assert.equal(config.commands.installChromium, 'npx playwright install chromium');
});

test('resolveRunnerRuntimeConfig lets cli args override environment', () => {
  const config = resolveRunnerRuntimeConfig({
    env: {
      WEB_UI_RUNNER_PORT: '39118',
      WEB_UI_RUNNER_SESSION_TTL_MINUTES: '15',
      WEB_UI_RUNNER_INSTALL_ID: 'env-install',
      WEB_UI_RUNNER_NAME: 'Env Runner',
      WEB_UI_RUNNER_DATA_DIR: 'D:\\env-data',
      WEB_UI_RUNNER_MAX_RESOURCE_SLOTS: '5',
    },
    argv: [
      '--port=39199',
      '--session-ttl-minutes=30',
      '--install-id=cli-install',
      '--runner-name=CLI Runner',
      '--data-dir=D:\\runner-data',
      '--max-resource-slots=8',
      '--start-command=web-ui-runner.exe',
    ],
    cwd: 'D:\\project',
    homeDir: 'C:\\Users\\tester',
    hostname: 'qa-machine',
  });

  assert.equal(config.port, 39199);
  assert.equal(config.sessionTtlMinutes, 30);
  assert.equal(config.installId, 'cli-install');
  assert.equal(config.runnerName, 'CLI Runner');
  assert.equal(config.dataDir, 'D:\\runner-data');
  assert.equal(config.authDir, join('D:\\runner-data', 'auth'));
  assert.equal(config.logDir, join('D:\\runner-data', 'logs'));
  assert.equal(config.maxResourceSlots, 8);
  assert.equal(config.commands.start, 'web-ui-runner.exe');
});

test('resolveRunnerRuntimeConfig clamps invalid numeric inputs', () => {
  const config = resolveRunnerRuntimeConfig({
    env: {
      WEB_UI_RUNNER_PORT: 'not-a-port',
      WEB_UI_RUNNER_SESSION_TTL_MINUTES: '-1',
      WEB_UI_RUNNER_MAX_RESOURCE_SLOTS: '0',
    },
    argv: [],
    cwd: 'D:\\project',
    homeDir: 'C:\\Users\\tester',
    hostname: 'qa-machine',
  });

  assert.equal(config.port, 39118);
  assert.equal(config.sessionTtlMinutes, 15);
  assert.equal(config.maxResourceSlots, 5);
});

test('ensureRunnerRuntimeDirectories creates data, auth, and log directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'web-ui-runner-config-'));
  const dataDir = join(root, 'runner-data');

  try {
    const config = resolveRunnerRuntimeConfig({
      env: {
        WEB_UI_RUNNER_DATA_DIR: dataDir,
      },
      argv: [],
      cwd: root,
      homeDir: root,
      hostname: 'qa-machine',
    });

    await ensureRunnerRuntimeDirectories(config);

    assert.equal(existsSync(config.dataDir), true);
    assert.equal(existsSync(config.authDir), true);
    assert.equal(existsSync(config.logDir), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
