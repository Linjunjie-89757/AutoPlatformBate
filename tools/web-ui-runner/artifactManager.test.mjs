import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';

import {
  isArtifactReference,
  resolveArtifactLocalPath,
  resolveArtifactUploadPath,
} from './artifactManager.mjs';

test('artifact manager leaves plain file paths unchanged', () => {
  assert.equal(isArtifactReference('C:/tmp/avatar.png'), false);
  assert.equal(resolveArtifactUploadPath({ artifactRefs: [] }, 'C:/tmp/avatar.png'), 'C:/tmp/avatar.png');
});

test('artifact manager resolves artifact references from localPath or path', async () => {
  const dir = join(tmpdir(), `web-ui-runner-artifact-${Date.now()}`);
  const filePath = join(dir, 'avatar.txt');
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, 'avatar', 'utf8');

  try {
    assert.equal(isArtifactReference('artifact:avatar'), true);
    assert.equal(resolveArtifactLocalPath({
      artifactRefs: [
        { fileId: 'avatar', fileName: 'avatar.txt', localPath: filePath },
        { fileId: 'fallback', path: filePath },
      ],
    }, 'avatar'), filePath);
    assert.equal(resolveArtifactUploadPath({
      artifactRefs: [{ artifactId: 'avatar', path: filePath }],
    }, 'artifact:avatar'), filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('artifact manager reports clear errors for missing artifact files', () => {
  assert.throws(
    () => resolveArtifactUploadPath({ artifactRefs: [] }, 'artifact:avatar'),
    /文件上传工件未下发|artifact/i,
  );
  assert.throws(
    () => resolveArtifactUploadPath({ artifactRefs: [{ fileId: 'avatar' }] }, 'artifact:avatar'),
    /文件上传工件未下载|localPath/i,
  );
});

test('artifact manager materializes inline base64 artifacts to a local file', async () => {
  const task = {
    runId: 'run-inline-artifact',
    artifactRefs: [{
      fileId: 'upload-file',
      fileName: 'upload.txt',
      contentBase64: Buffer.from('inline-upload-content').toString('base64'),
    }],
  };

  const filePath = resolveArtifactUploadPath(task, 'artifact:upload-file');

  try {
    assert.match(filePath, /upload-file|upload\.txt/);
    assert.equal(await readFile(filePath, 'utf8'), 'inline-upload-content');
    assert.equal(resolveArtifactUploadPath(task, 'artifact:upload-file'), filePath);
  } finally {
    await rm(filePath, { force: true });
  }
});
