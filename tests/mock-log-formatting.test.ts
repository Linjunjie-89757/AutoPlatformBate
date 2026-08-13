import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatMockLogHeaders,
  formatMockLogJson,
} from '../src/widgets/config-mock-panel/mockLogFormatting.ts'

test('mock log headers recursively mask sensitive header values', () => {
  const formatted = formatMockLogHeaders(
    JSON.stringify({
      Accept: 'application/json',
      Authorization: 'Bearer visible-secret',
      'x-mock-execution-token': 'visible-token',
      nested: {
        password: 'visible-password',
        traceId: 'trace-001',
      },
      'Set-Cookie': ['session=visible-cookie'],
    }),
  )

  assert.deepEqual(JSON.parse(formatted), {
    Accept: 'application/json',
    Authorization: '••••••••',
    'x-mock-execution-token': '••••••••',
    nested: {
      password: '••••••••',
      traceId: 'trace-001',
    },
    'Set-Cookie': '••••••••',
  })
})

test('mock log headers conservatively hide malformed sensitive content', () => {
  assert.equal(formatMockLogHeaders('Authorization: Bearer visible-secret'), '••••••••')
  assert.equal(formatMockLogHeaders('Accept: application/json'), 'Accept: application/json')
})

test('mock log body formatting does not mask ordinary payload fields', () => {
  const formatted = formatMockLogJson(JSON.stringify({ token: 'business-token', status: 'ok' }))
  assert.deepEqual(JSON.parse(formatted), { token: 'business-token', status: 'ok' })
})
