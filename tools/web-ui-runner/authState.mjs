const DEFAULT_MIN_TTL_MS = 5 * 60_000;

export function evaluateAuthStateHealth(input = {}) {
  const required = input.required === true;
  const workspaceId = optionalString(input.workspaceId) || 'default-workspace';
  const environmentId = optionalString(input.environmentId) || 'default-environment';
  if (!required) {
    return {
      ok: true,
      status: 'NOT_REQUIRED',
      reasonCode: null,
      message: '',
    };
  }

  if (input.exists !== true) {
    return failure(
      'MISSING',
      'AUTH_STATE_MISSING',
      `本地登录状态不存在：当前用例要求登录状态，请先在本地 Runner 中打开目标环境页面并保存登录状态（工作空间：${workspaceId}，环境：${environmentId}）`,
    );
  }

  const expiresAtMs = resolveAuthStateExpiresAtMs(input);
  if (expiresAtMs === null) {
    return {
      ok: true,
      status: 'VALID',
      reasonCode: null,
      message: '',
      expiresAt: null,
      remainingMs: null,
    };
  }

  const now = Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now();
  const remainingMs = expiresAtMs - now;
  const expiresAt = new Date(expiresAtMs).toISOString();
  if (remainingMs <= 0) {
    return failure(
      'EXPIRED',
      'AUTH_STATE_EXPIRED',
      `本地登录状态已过期：当前用例要求登录状态，请重新打开目标环境页面并保存登录状态（过期时间：${expiresAt}）`,
      { expiresAt, remainingMs: 0 },
    );
  }

  const minTtlMs = Number.isFinite(Number(input.minTtlMs)) ? Number(input.minTtlMs) : DEFAULT_MIN_TTL_MS;
  if (remainingMs < minTtlMs) {
    return failure(
      'EXPIRING_SOON',
      'AUTH_STATE_EXPIRING_SOON',
      `本地登录状态即将过期：剩余约 ${Math.ceil(remainingMs / 60_000)} 分钟，低于本次执行要求，请重新保存登录状态后再执行`,
      { expiresAt, remainingMs },
    );
  }

  return {
    ok: true,
    status: 'VALID',
    reasonCode: null,
    message: '',
    expiresAt,
    remainingMs,
  };
}

export function findStorageStateExpiresAt(storageState = {}) {
  const cookies = Array.isArray(storageState.cookies) ? storageState.cookies : [];
  const expires = cookies
    .map(cookie => Number(cookie?.expires))
    .filter(value => Number.isFinite(value) && value > 0)
    .map(value => value * 1000);
  if (expires.length === 0) {
    return null;
  }
  return Math.min(...expires);
}

function resolveAuthStateExpiresAtMs(input) {
  const direct = parseDateLike(input.expiresAt);
  if (direct !== null) {
    return direct;
  }
  return findStorageStateExpiresAt(input.storageState);
}

function parseDateLike(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function failure(status, reasonCode, message, extra = {}) {
  return {
    ok: false,
    status,
    reasonCode,
    message,
    ...extra,
  };
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
