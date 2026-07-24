const api = window.localRunnerDesktop;

const refs = {
  processStatus: document.querySelector('#processStatus'),
  healthText: document.querySelector('#healthText'),
  pollText: document.querySelector('#pollText'),
  portText: document.querySelector('#portText'),
  pidText: document.querySelector('#pidText'),
  apiBaseUrlInput: document.querySelector('#apiBaseUrlInput'),
  runnerNameInput: document.querySelector('#runnerNameInput'),
  portInput: document.querySelector('#portInput'),
  autoStartInput: document.querySelector('#autoStartInput'),
  startBtn: document.querySelector('#startBtn'),
  stopBtn: document.querySelector('#stopBtn'),
  saveBtn: document.querySelector('#saveBtn'),
  connectBtn: document.querySelector('#connectBtn'),
  disconnectBtn: document.querySelector('#disconnectBtn'),
  openLogsBtn: document.querySelector('#openLogsBtn'),
  capabilityList: document.querySelector('#capabilityList'),
  logs: document.querySelector('#logs'),
  logPathText: document.querySelector('#logPathText'),
};

let latestState;
let touched = false;

function configFromForm() {
  return {
    apiBaseUrl: refs.apiBaseUrlInput.value,
    runnerName: refs.runnerNameInput.value,
    port: Number(refs.portInput.value),
    autoStart: refs.autoStartInput.checked,
  };
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.dataset.busy = busy ? 'true' : 'false';
}

async function runAction(button, action) {
  setBusy(button, true);
  try {
    await action();
    await refresh();
  } catch (error) {
    appendInlineLog(`操作失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setBusy(button, false);
  }
}

function applyState(state) {
  latestState = state;
  const running = Boolean(state?.process?.running);
  const healthOk = Boolean(state?.health?.success);
  const poller = state?.taskPoll?.poller;

  refs.processStatus.textContent = running ? '运行中' : '未运行';
  refs.processStatus.className = `status-pill ${running ? 'success' : 'muted'}`;
  refs.healthText.textContent = healthOk ? '在线' : '离线';
  refs.pollText.textContent = poller ? `已连接 ${poller.completedCount || 0}/${poller.failedCount || 0}` : '未连接';
  refs.portText.textContent = String(state?.config?.port || '-');
  refs.pidText.textContent = state?.process?.pid ? String(state.process.pid) : '-';
  refs.logPathText.textContent = state?.paths?.logDir || '-';

  refs.startBtn.disabled = running;
  refs.stopBtn.disabled = !running;
  refs.connectBtn.disabled = !running;
  refs.disconnectBtn.disabled = !running || !poller;

  if (!touched) {
    refs.apiBaseUrlInput.value = state?.config?.apiBaseUrl || '';
    refs.runnerNameInput.value = state?.config?.runnerName || '';
    refs.portInput.value = state?.config?.port || '';
    refs.autoStartInput.checked = state?.config?.autoStart !== false;
  }

  refs.capabilityList.innerHTML = '';
  for (const item of state?.capabilities || []) {
    const row = document.createElement('div');
    row.className = 'capability';
    row.innerHTML = `<span>${item.label}</span><strong class="${item.enabled ? 'enabled' : 'disabled'}">${item.enabled ? '已启用' : '预留'}</strong>`;
    refs.capabilityList.appendChild(row);
  }

  refs.logs.textContent = (state?.logLines || []).slice(-80).join('\n') || '暂无日志';
  refs.logs.scrollTop = refs.logs.scrollHeight;
}

function appendInlineLog(text) {
  const current = refs.logs.textContent && refs.logs.textContent !== '暂无日志' ? refs.logs.textContent : '';
  refs.logs.textContent = `${current}\n${new Date().toISOString()} ${text}`.trim();
}

async function refresh() {
  applyState(await api.getState());
}

refs.apiBaseUrlInput.addEventListener('input', () => { touched = true; });
refs.runnerNameInput.addEventListener('input', () => { touched = true; });
refs.portInput.addEventListener('input', () => { touched = true; });
refs.autoStartInput.addEventListener('change', () => { touched = true; });

refs.startBtn.addEventListener('click', () => runAction(refs.startBtn, () => api.start()));
refs.stopBtn.addEventListener('click', () => runAction(refs.stopBtn, () => api.stop()));
refs.saveBtn.addEventListener('click', () => runAction(refs.saveBtn, async () => {
  await api.saveConfig(configFromForm());
  touched = false;
}));
refs.connectBtn.addEventListener('click', () => runAction(refs.connectBtn, async () => {
  await api.saveConfig(configFromForm());
  touched = false;
  await api.connectPlatform();
}));
refs.disconnectBtn.addEventListener('click', () => runAction(refs.disconnectBtn, () => api.disconnectPlatform()));
refs.openLogsBtn.addEventListener('click', () => api.openLogs());

api.onState((state) => applyState(state));
refresh();
setInterval(refresh, 3000);
