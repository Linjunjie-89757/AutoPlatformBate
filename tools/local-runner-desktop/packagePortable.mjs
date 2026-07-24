import { spawnSync } from 'node:child_process';
import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RUNNER_PRODUCT_NAME, RUNNER_VERSION } from '../web-ui-runner/runnerConfig.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const productName = RUNNER_PRODUCT_NAME;
const outputRoot = join(projectRoot, 'release', 'local-runner', `portable-v${RUNNER_VERSION}`);
const archiveName = `Auto-Platform-Local-Runner-v${RUNNER_VERSION}-windows-x64.zip`;
const archivePath = join(projectRoot, 'release', 'local-runner', archiveName);
const appRoot = join(outputRoot, 'resources', 'app');
const electronDist = join(projectRoot, 'node_modules', 'electron', 'dist');

if (!existsSync(electronDist)) {
  throw new Error('Missing Electron runtime. Please run: npm.cmd install');
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(appRoot, { recursive: true });

await cp(electronDist, outputRoot, { recursive: true });
await copyAppFiles();
await writePortablePackageJson();
await renameExecutable();
await createArchive();

console.log(`Portable Local Runner created: ${join(outputRoot, `${productName}.exe`)}`);
console.log(`Download archive created: ${archivePath}`);

async function copyAppFiles() {
  await cp(join(projectRoot, 'tools', 'local-runner-desktop'), join(appRoot, 'tools', 'local-runner-desktop'), {
    recursive: true,
    filter: (source) => !source.endsWith('packagePortable.mjs'),
  });

  await cp(join(projectRoot, 'tools', 'web-ui-runner'), join(appRoot, 'tools', 'web-ui-runner'), {
    recursive: true,
    filter: (source) => {
      const normalized = source.replace(/\\/g, '/');
      return !/(\.test|\.integration\.test|\.e2e|\.tmp)\.mjs$/.test(normalized);
    },
  });

  await mkdir(join(appRoot, 'node_modules'), { recursive: true });
  await cp(join(projectRoot, 'node_modules', 'playwright'), join(appRoot, 'node_modules', 'playwright'), { recursive: true });
  await cp(join(projectRoot, 'node_modules', 'playwright-core'), join(appRoot, 'node_modules', 'playwright-core'), { recursive: true });
}

async function writePortablePackageJson() {
  const appPackage = {
    name: 'auto-platform-local-runner',
    version: RUNNER_VERSION,
    type: 'module',
    main: 'tools/local-runner-desktop/main.mjs',
  };
  await writeFile(join(appRoot, 'package.json'), `${JSON.stringify(appPackage, null, 2)}\n`, 'utf8');
}

async function renameExecutable() {
  const original = join(outputRoot, 'electron.exe');
  const renamed = join(outputRoot, `${productName}.exe`);
  await rm(renamed, { force: true });
  await rename(original, renamed);
}

async function createArchive() {
  await rm(archivePath, { force: true });
  const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';
  const result = spawnSync(
    tarCommand,
    ['-a', '-c', '-f', archivePath, '-C', outputRoot, '.'],
    { stdio: 'inherit' },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Failed to create Local Runner archive (exit code ${result.status ?? 'unknown'})`);
  }
}
