import test from 'node:test'
import assert from 'node:assert/strict'

import {
  artifactFileIdFromInputValue,
  buildWebUiFileUploadArtifactRefs,
  isFileUploadArtifactValue,
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
