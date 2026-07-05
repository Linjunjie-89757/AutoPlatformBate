import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRecordedWebUiFileUploadArtifact,
  artifactFileIdFromInputValue,
  bindRecordedWebUiFileUploadArtifact,
  buildWebUiFileUploadArtifactRefs,
  findFirstWebUiFileUploadReplayIssue,
  getWebUiFileUploadReplayIssue,
  hasUnsavedWebUiFileUploadArtifactChanges,
  isFileUploadArtifactValue,
  isReplayableWebUiFileUploadValue,
  RECORDED_WEB_UI_UPLOAD_ARTIFACT_MAX_SIZE_BYTES,
  type WebUiFileUploadArtifactBinding,
  type WebUiFileUploadArtifactStep,
} from '../src/entities/web-ui-automation/lib/fileUploadArtifacts.ts'

test('extracts artifact file ids from upload input values', () => {
  assert.equal(artifactFileIdFromInputValue('artifact:avatar'), 'avatar')
  assert.equal(artifactFileIdFromInputValue(' Artifact: avatar '), 'avatar')
  assert.equal(artifactFileIdFromInputValue('artifact:'), null)
  assert.equal(artifactFileIdFromInputValue('D:/fixtures/avatar.png'), null)
  assert.equal(isFileUploadArtifactValue('artifact:file-1'), true)
  assert.equal(isFileUploadArtifactValue('/tmp/file-1.txt'), false)
})

test('builds refs only for enabled FILE_UPLOAD artifact inputs with bindings', () => {
  const result = buildWebUiFileUploadArtifactRefs([
    step({ inputValue: 'D:/fixtures/plain-path.txt' }),
    step({ inputValue: 'artifact:avatar' }),
    step({ enabled: false, inputValue: 'artifact:disabled' }),
    step({ type: 'FILL', inputValue: 'artifact:not-upload' }),
  ], {
    avatar: binding({ fileId: 'avatar', fileName: 'avatar.png', contentType: 'image/png', contentBase64: 'YWJj', size: 3 }),
    disabled: binding({ fileId: 'disabled', fileName: 'disabled.txt', contentBase64: 'ZA==' }),
    'not-upload': binding({ fileId: 'not-upload', fileName: 'text.txt', contentBase64: 'dA==' }),
  })

  assert.deepEqual(result.missingFileIds, [])
  assert.deepEqual(result.artifactRefs, [{
    fileId: 'avatar',
    artifactId: 'avatar',
    fileName: 'avatar.png',
    contentType: 'image/png',
    contentBase64: 'YWJj',
    size: 3,
  }])
})

test('reports missing file bindings and dedupes duplicate artifact ids', () => {
  const result = buildWebUiFileUploadArtifactRefs([
    step({ inputValue: 'artifact:missing' }),
    step({ inputValue: 'artifact:missing' }),
    step({ inputValue: 'artifact:report' }),
    step({ inputValue: 'artifact:report' }),
  ], {
    report: binding({ fileId: 'report', fileName: 'report.xlsx', contentBase64: 'cmVwb3J0' }),
  })

  assert.deepEqual(result.missingFileIds, ['missing'])
  assert.deepEqual(result.artifactRefs, [{
    fileId: 'report',
    artifactId: 'report',
    fileName: 'report.xlsx',
    contentType: 'application/octet-stream',
    contentBase64: 'cmVwb3J0',
  }])
})

test('detects unsaved upload artifact changes that must be persisted before local run', () => {
  assert.equal(hasUnsavedWebUiFileUploadArtifactChanges([
    step({ inputValue: 'artifact:avatar' }),
  ], [
    step({ inputValue: 'D:/fixtures/avatar.png' }),
  ]), true)

  assert.equal(hasUnsavedWebUiFileUploadArtifactChanges([
    step({ inputValue: 'artifact:new-file' }),
  ], []), true)
})

test('ignores already persisted upload artifact inputs', () => {
  assert.equal(hasUnsavedWebUiFileUploadArtifactChanges([
    step({ inputValue: ' artifact:avatar ' }),
  ], [
    step({ inputValue: 'artifact:avatar' }),
  ]), false)

  assert.equal(hasUnsavedWebUiFileUploadArtifactChanges([
    step({ inputValue: 'D:/fixtures/avatar.png' }),
  ], [
    step({ inputValue: 'D:/fixtures/avatar.png' }),
  ]), false)
})

test('detects replay issues for recorded upload names and missing artifact bindings', () => {
  assert.equal(getWebUiFileUploadReplayIssue(step({ inputValue: 'upload-demo.txt' })), 'NON_REPLAYABLE_VALUE')
  assert.equal(getWebUiFileUploadReplayIssue(step({ inputValue: 'artifact:avatar' })), 'MISSING_BINDING')
  assert.equal(getWebUiFileUploadReplayIssue(step({ inputValue: 'artifact:avatar' }), {
    avatar: binding({ fileId: 'avatar', fileName: 'avatar.png', contentBase64: 'YWJj' }),
  }), null)
  assert.equal(getWebUiFileUploadReplayIssue(step({ inputValue: 'D:/fixtures/avatar.png' })), null)
  assert.equal(isReplayableWebUiFileUploadValue('upload-demo.txt'), false)
  assert.equal(isReplayableWebUiFileUploadValue('artifact:avatar'), true)
})

test('applies recorded upload artifact to a replayable file upload step', () => {
  const uploadStep = step({ inputValue: 'recorded-upload.txt' })
  const binding = applyRecordedWebUiFileUploadArtifact(uploadStep, 'recorded-file', {
    fileName: 'recorded-upload.txt',
    contentType: 'text/plain',
    contentBase64: 'cmVjb3JkZWQ=',
    size: 8,
  }, 1234)

  assert.equal(uploadStep.inputValue, 'artifact:recorded-file')
  assert.deepEqual(binding, {
    fileId: 'recorded-file',
    fileName: 'recorded-upload.txt',
    contentType: 'text/plain',
    contentBase64: 'cmVjb3JkZWQ=',
    size: 8,
    updatedAt: 1234,
  })
  assert.equal(getWebUiFileUploadReplayIssue(uploadStep, {
    'recorded-file': binding || undefined,
  }), null)
})

test('keeps recorded upload unchanged when artifact content is missing', () => {
  const uploadStep = step({ inputValue: 'recorded-upload.txt' })
  const binding = applyRecordedWebUiFileUploadArtifact(uploadStep, 'recorded-file', {
    fileName: 'recorded-upload.txt',
    contentBase64: '',
  }, 1234)

  assert.equal(binding, null)
  assert.equal(uploadStep.inputValue, 'recorded-upload.txt')
})

test('reports recorded upload artifact boundary states without mutating the step', () => {
  const tooLargeStep = step({ inputValue: 'large-upload.bin' })
  const tooLarge = bindRecordedWebUiFileUploadArtifact(tooLargeStep, 'large-file', {
    fileName: 'large-upload.bin',
    contentBase64: 'ignored',
    size: RECORDED_WEB_UI_UPLOAD_ARTIFACT_MAX_SIZE_BYTES + 1,
  }, 1234)
  assert.equal(tooLarge.status, 'TOO_LARGE')
  assert.equal(tooLarge.limitBytes, RECORDED_WEB_UI_UPLOAD_ARTIFACT_MAX_SIZE_BYTES)
  assert.equal(tooLargeStep.inputValue, 'large-upload.bin')

  const emptyStep = step({ inputValue: 'empty-upload.txt' })
  const empty = bindRecordedWebUiFileUploadArtifact(emptyStep, 'empty-file', {
    fileName: 'empty-upload.txt',
    contentBase64: '',
    size: 0,
  }, 1234)
  assert.equal(empty.status, 'EMPTY_CONTENT')
  assert.equal(emptyStep.inputValue, 'empty-upload.txt')

  const multiStep = step({ inputValue: 'multi-upload.txt' })
  const multi = bindRecordedWebUiFileUploadArtifact(multiStep, 'multi-file', {
    fileName: 'multi-upload.txt',
    captureStatus: 'UNSUPPORTED_MULTIPLE',
    fileCount: 2,
  }, 1234)
  assert.equal(multi.status, 'UNSUPPORTED_MULTIPLE')
  assert.equal(multi.fileCount, 2)
  assert.equal(multiStep.inputValue, 'multi-upload.txt')
})

test('finds the first upload step that still needs replay repair', () => {
  assert.deepEqual(findFirstWebUiFileUploadReplayIssue([
    step({ type: 'CLICK', inputValue: 'ignored' }),
    step({ inputValue: 'artifact:avatar' }),
    step({ inputValue: 'upload-demo.txt' }),
  ]), {
    index: 1,
    issue: 'MISSING_BINDING',
    fileId: 'avatar',
  })

  assert.deepEqual(findFirstWebUiFileUploadReplayIssue([
    step({ inputValue: 'D:/fixtures/avatar.png' }),
    step({ inputValue: 'artifact:avatar' }),
  ], {
    avatar: binding({ fileId: 'avatar', fileName: 'avatar.png', contentBase64: 'YWJj' }),
  }), null)
})

function step(overrides: Partial<WebUiFileUploadArtifactStep>): WebUiFileUploadArtifactStep {
  return {
    type: 'FILE_UPLOAD',
    inputValue: null,
    enabled: true,
    ...overrides,
  }
}

function binding(overrides: Partial<WebUiFileUploadArtifactBinding>): WebUiFileUploadArtifactBinding {
  return {
    fileId: 'file',
    fileName: 'file.bin',
    contentBase64: 'ZmlsZQ==',
    ...overrides,
  }
}
