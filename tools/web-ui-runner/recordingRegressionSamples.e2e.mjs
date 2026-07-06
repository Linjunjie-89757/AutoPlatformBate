import { spawn } from 'node:child_process';
import { once } from 'node:events';

const scenarios = [
  {
    name: 'platform recording acceptance',
    args: ['tools/web-ui-runner/recordingPlatformAcceptance.e2e.mjs'],
  },
  {
    name: 'dialog and new tab boundary',
    args: ['--test', 'tools/web-ui-runner/recordingBoundaries.integration.test.mjs'],
  },
  {
    name: 'download evidence',
    args: ['--test', 'tools/web-ui-runner/recordingDownload.integration.test.mjs'],
  },
  {
    name: 'drag-to replay',
    args: ['--test', 'tools/web-ui-runner/recordingDrag.integration.test.mjs'],
  },
  {
    name: 'coordinate drag replay',
    args: ['--test', 'tools/web-ui-runner/recordingCoordinateDrag.integration.test.mjs'],
  },
  {
    name: 'file picker replay',
    args: ['--test', 'tools/web-ui-runner/recordingFilePicker.integration.test.mjs'],
  },
];

for (const scenario of scenarios) {
  console.log(`[recording-regression] start ${scenario.name}`);
  const code = await runNodeScenario(scenario.args);
  if (code !== 0) {
    console.error(`[recording-regression] failed ${scenario.name} with exit code ${code}`);
    process.exit(code || 1);
  }
  console.log(`[recording-regression] passed ${scenario.name}`);
}

console.log('[recording-regression] all samples passed');

async function runNodeScenario(args) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  const [code] = await once(child, 'exit');
  return code;
}
