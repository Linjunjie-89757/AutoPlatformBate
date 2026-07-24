import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

export const RUNNER_VERSION = '0.1.0';
export const RUNNER_PRODUCT_NAME = 'Auto Platform Local Runner';
export const DEFAULT_RUNNER_HOST = '127.0.0.1';
export const DEFAULT_RUNNER_PORT = 39118;
export const DEFAULT_SESSION_TTL_MINUTES = 15;
export const DEFAULT_MAX_RESOURCE_SLOTS = 5;
export const DEFAULT_START_COMMAND = 'npm.cmd run runner';
export const DEFAULT_INSTALL_CHROMIUM_COMMAND = 'npx playwright install chromium';
export const DEFAULT_RUNNER_CAPABILITIES = Object.freeze([
  'WEB_ELEMENT_COLLECT',
  'WEB_ELEMENT_VALIDATE',
  'WEB_CASE_RUN',
  'API_CASE_RUN',
  'API_SCENARIO_RUN',
  'API_SUITE_RUN',
]);

export function resolveRunnerRuntimeConfig(input = {}) {
  const env = input.env || process.env;
  const argvOptions = parseRunnerArgs(input.argv || process.argv.slice(2));
  const homeDir = input.homeDir || '';
  const hostname = input.hostname || 'local-machine';
  const dataDir = optionalString(argvOptions.dataDir)
    || optionalString(env.WEB_UI_RUNNER_DATA_DIR)
    || join(homeDir, '.auto-web-ui-runner');
  const runnerName = optionalString(argvOptions.runnerName)
    || optionalString(env.WEB_UI_RUNNER_NAME)
    || RUNNER_PRODUCT_NAME;

  return {
    productName: RUNNER_PRODUCT_NAME,
    runnerVersion: RUNNER_VERSION,
    host: DEFAULT_RUNNER_HOST,
    port: normalizePositiveInteger(argvOptions.port ?? env.WEB_UI_RUNNER_PORT, DEFAULT_RUNNER_PORT),
    dataDir,
    authDir: join(dataDir, 'auth'),
    logDir: join(dataDir, 'logs'),
    configPath: join(dataDir, 'config.json'),
    sessionTtlMinutes: normalizePositiveNumber(
      argvOptions.sessionTtlMinutes ?? env.WEB_UI_RUNNER_SESSION_TTL_MINUTES,
      DEFAULT_SESSION_TTL_MINUTES,
    ),
    maxResourceSlots: normalizePositiveInteger(
      argvOptions.maxResourceSlots ?? env.WEB_UI_RUNNER_MAX_RESOURCE_SLOTS,
      DEFAULT_MAX_RESOURCE_SLOTS,
    ),
    installId: optionalString(argvOptions.installId)
      || optionalString(env.WEB_UI_RUNNER_INSTALL_ID)
      || `web-ui-runner-${hostname}`,
    runnerName,
    machineHint: {
      deviceName: hostname,
      runnerName,
      source: 'node-local-runner',
    },
    capabilities: [...DEFAULT_RUNNER_CAPABILITIES],
    commands: {
      start: optionalString(argvOptions.startCommand) || optionalString(env.WEB_UI_RUNNER_START_COMMAND) || DEFAULT_START_COMMAND,
      installChromium: optionalString(env.WEB_UI_RUNNER_INSTALL_CHROMIUM_COMMAND) || DEFAULT_INSTALL_CHROMIUM_COMMAND,
    },
  };
}

export function parseRunnerArgs(argv = []) {
  const result = {};
  for (const arg of argv) {
    const text = optionalString(arg);
    if (!text.startsWith('--')) {
      continue;
    }
    const [rawKey, ...rawValueParts] = text.slice(2).split('=');
    const key = normalizeArgKey(rawKey);
    const value = rawValueParts.length > 0 ? rawValueParts.join('=') : 'true';
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

export async function ensureRunnerRuntimeDirectories(config) {
  await mkdir(config.dataDir, { recursive: true });
  await mkdir(config.authDir, { recursive: true });
  await mkdir(config.logDir, { recursive: true });
}

function normalizeArgKey(value) {
  const text = optionalString(value);
  if (!text) {
    return '';
  }
  return text.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizePositiveInteger(value, fallback) {
  const number = Number.parseInt(optionalString(value), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(optionalString(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
