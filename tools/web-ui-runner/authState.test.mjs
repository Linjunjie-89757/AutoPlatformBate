import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateAuthStateHealth } from './authState.mjs';

test('evaluateAuthStateHealth allows cases that do not require auth state', () => {
  const result = evaluateAuthStateHealth({
    required: false,
    exists: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'NOT_REQUIRED');
});

test('evaluateAuthStateHealth blocks missing required auth state', () => {
  const result = evaluateAuthStateHealth({
    required: true,
    exists: false,
    workspaceId: 'account-open',
    environmentId: 'test',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'MISSING');
  assert.match(result.message, /登录状态不存在/);
  assert.equal(result.reasonCode, 'AUTH_STATE_MISSING');
});

test('evaluateAuthStateHealth blocks expired auth state', () => {
  const result = evaluateAuthStateHealth({
    required: true,
    exists: true,
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'EXPIRED');
  assert.equal(result.reasonCode, 'AUTH_STATE_EXPIRED');
});

test('evaluateAuthStateHealth blocks auth state that will expire before expected run window', () => {
  const result = evaluateAuthStateHealth({
    required: true,
    exists: true,
    expiresAt: new Date(Date.now() + 3 * 60_000).toISOString(),
    minTtlMs: 5 * 60_000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'EXPIRING_SOON');
  assert.equal(result.reasonCode, 'AUTH_STATE_EXPIRING_SOON');
});

test('evaluateAuthStateHealth allows valid required auth state', () => {
  const result = evaluateAuthStateHealth({
    required: true,
    exists: true,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    minTtlMs: 5 * 60_000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'VALID');
});
