import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function isArtifactReference(value) {
  return /^artifact:/i.test(optionalString(value));
}

export function resolveArtifactUploadPath(task, value) {
  const inputValue = optionalString(value);
  if (!inputValue) {
    throw new Error('FILE_UPLOAD step requires inputValue');
  }
  if (!isArtifactReference(inputValue)) {
    return inputValue;
  }
  const fileId = inputValue.replace(/^artifact:/i, '').trim();
  return resolveArtifactLocalPath(task, fileId);
}

export function resolveArtifactLocalPath(task, fileId) {
  const normalizedFileId = optionalString(fileId);
  if (!normalizedFileId) {
    throw new Error('文件上传工件引用缺少 fileId');
  }
  const artifact = findArtifactRef(task, normalizedFileId);
  if (!artifact) {
    throw new Error(`文件上传工件未下发：${normalizedFileId}。请确认任务 artifactRefs 包含该文件。`);
  }
  const localPath = optionalString(artifact.localPath || artifact.path) || materializeInlineArtifact(task, artifact, normalizedFileId);
  if (!localPath) {
    throw new Error(`文件上传工件未下载：${normalizedFileId}。请先由平台下发 artifactRefs.localPath。`);
  }
  if (!existsSync(localPath)) {
    throw new Error(`文件上传工件本地文件不存在：${normalizedFileId} (${localPath})`);
  }
  return localPath;
}

export function findArtifactRef(task, fileId) {
  const normalizedFileId = optionalString(fileId);
  if (!normalizedFileId || !Array.isArray(task?.artifactRefs)) {
    return null;
  }
  return task.artifactRefs.find((item) => {
    const candidates = [
      item?.fileId,
      item?.artifactId,
      item?.id,
    ].map(optionalString);
    return candidates.includes(normalizedFileId);
  }) || null;
}

function materializeInlineArtifact(task, artifact, fileId) {
  const contentBase64 = optionalString(artifact?.contentBase64 || artifact?.base64);
  if (!contentBase64) {
    return '';
  }
  const runId = sanitizePathSegment(optionalString(task?.runId) || 'local-runner-task');
  const safeFileId = sanitizePathSegment(fileId);
  const safeFileName = sanitizeFileName(optionalString(artifact.fileName || artifact.name) || safeFileId);
  const artifactDir = join(tmpdir(), 'auto-web-ui-runner-artifacts', runId);
  const artifactFileDir = join(artifactDir, safeFileId);
  mkdirSync(artifactFileDir, { recursive: true });
  const localPath = join(artifactFileDir, safeFileName);
  writeFileSync(localPath, Buffer.from(contentBase64, 'base64'));
  artifact.localPath = localPath;
  return localPath;
}

function sanitizePathSegment(value) {
  const sanitized = optionalString(value).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'artifact';
}

function sanitizeFileName(value) {
  const sanitized = optionalString(value).replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'upload.bin';
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
