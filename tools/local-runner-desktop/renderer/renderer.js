const api = window.localRunnerDesktop;

const refs = {
  versionText: document.querySelector('#versionText'),
  overallStatus: document.querySelector('#overallStatus'),
  overallStatusText: document.querySelector('#overallStatusText'),
  connectionTitle: document.querySelector('#connectionTitle'),
  connectionBadge: document.querySelector('#connectionBadge'),
  connectionMeta: document.querySelector('#connectionMeta'),
  notice: document.querySelector('#notice'),
  taskSection: document.querySelector('#taskSection'),
  taskTitle: document.querySelector('#taskTitle'),
  taskState: document.querySelector('#taskState'),
  taskTypeText: document.querySelector('#taskTypeText'),
  taskMetaText: document.querySelector('#taskMetaText'),
  capabilityCount: document.querySelector('#capabilityCount'),
  capabilityList: document.querySelector('#capabilityList'),
  settingsDetails: document.querySelector('#settingsDetails'),
  settingsSummary: document.querySelector('#settingsSummary'),
  healthText: document.querySelector('#healthText'),
  pollText: document.querySelector('#pollText'),
  pidText: document.querySelector('#pidText'),
  lastSyncText: document.querySelector('#lastSyncText'),
  apiBaseUrlInput: document.querySelector('#apiBaseUrlInput'),
  runnerNameInput: document.querySelector('#runnerNameInput'),
  portInput: document.querySelector('#portInput'),
  autoStartInput: document.querySelector('#autoStartInput'),
  processBtn: document.querySelector('#processBtn'),
  connectionBtn: document.querySelector('#connectionBtn'),
  saveBtn: document.querySelector('#saveBtn'),
  openLogsBtn: document.querySelector('#openLogsBtn'),
  logsDetails: document.querySelector('#logsDetails'),
  logs: document.querySelector('#logs'),
  logPathText: document.querySelector('#logPathText'),
};

const taskTypeLabels = {
  WEB_ELEMENT_VALIDATE: 'Web UI 元素验证',
  WEB_CASE_RUN: 'Web UI 用例执行',
  API_CASE_RUN: '接口用例执行',
  API_SCENARIO_RUN: '接口场景执行',
  API_SUITE_RUN: '接口套件执行',
};

const capabilityColors = {
  API: '#ff7d00',
  WEB_UI: '#0284c7',
  RECORDING: '#7816ff',
  FILE_UPLOAD: '#00b42a',
};

let latestState;
let touched = false;
let initialized = false;
let previousConnected = false;

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

function setNotice(message = '') {
  refs.notice.textContent = message;
  refs.notice.hidden = !message;
  if (message) {
    refs.logsDetails.open = true;
  }
}

async function runAction(button, action) {
  setBusy(button, true);
  setNotice();
  try {
    await action();
    await refresh();
  } catch (error) {
    const message = `操作失败：${error instanceof Error ? error.message : String(error)}`;
    setNotice(message);
    appendInlineLog(message);
  } finally {
    setBusy(button, false);
  }
}

function applyState(state) {
  latestState = state;
  const running = Boolean(state?.process?.running);
  const healthOk = Boolean(state?.health?.success);
  const poller = state?.taskPoll?.poller;
  const currentRunId = poller?.currentRunId || '';
  const currentTaskType = poller?.currentTaskType || '';
  const connected = Boolean(running && poller?.running);
  const executing = Boolean(connected && currentRunId);

  refs.versionText.textContent = `v${state?.version || state?.health?.runnerVersion || '-'}`;
  applyOverallStatus({ running, connected, executing });
  applyConnectionState({ state, running, healthOk, connected, poller });
  applyTaskState({ connected, executing, currentRunId, currentTaskType, poller });
  applyCapabilities(state?.capabilities || []);

  refs.healthText.textContent = healthOk ? '正常' : running ? '启动中' : '未启动';
  refs.pollText.textContent = connected ? '已连接' : '未连接';
  refs.pidText.textContent = state?.process?.pid ? String(state.process.pid) : '-';
  refs.lastSyncText.textContent = formatRelativeTime(poller?.lastTickAt);
  refs.logPathText.textContent = state?.paths?.logDir || '暂无日志目录';
  refs.settingsSummary.textContent = connected
    ? `${state?.config?.runnerName || 'Local Runner'} · 端口 ${state?.config?.port || '-'}`
    : '连接参数和本地运行状态';

  refs.processBtn.textContent = running ? '停止服务' : '启动服务';
  refs.connectionBtn.textContent = connected ? '断开连接' : '连接平台';
  refs.connectionBtn.disabled = !running;

  if (!touched) {
    refs.apiBaseUrlInput.value = state?.config?.apiBaseUrl || '';
    refs.runnerNameInput.value = state?.config?.runnerName || '';
    refs.portInput.value = state?.config?.port || '';
    refs.autoStartInput.checked = state?.config?.autoStart !== false;
  }

  if (!initialized) {
    refs.settingsDetails.open = !connected;
    initialized = true;
  } else if (connected && !previousConnected && !touched) {
    refs.settingsDetails.open = false;
  }
  previousConnected = connected;

  refs.logs.textContent = (state?.logLines || []).slice(-80).join('\n') || '暂无日志';
  refs.logs.scrollTop = refs.logs.scrollHeight;
}

function applyOverallStatus({ running, connected, executing }) {
  let label = '未启动';
  let tone = 'danger';
  if (executing) {
    label = '执行中';
    tone = 'running';
  } else if (connected) {
    label = '已连接';
    tone = 'success';
  } else if (running) {
    label = '待连接';
    tone = 'warning';
  }
  refs.overallStatus.dataset.tone = tone;
  refs.overallStatusText.textContent = label;
}

function applyConnectionState({ state, running, healthOk, connected, poller }) {
  if (connected) {
    refs.connectionTitle.textContent = '已连接到自动化平台';
    refs.connectionBadge.textContent = '在线';
    refs.connectionBadge.dataset.tone = 'success';
    refs.connectionMeta.textContent = `${state?.config?.apiBaseUrl || '-'} · ${state?.config?.runnerName || 'Local Runner'} · 最近同步 ${formatRelativeTime(poller?.lastTickAt)}`;
    return;
  }

  if (running && healthOk) {
    refs.connectionTitle.textContent = '本地服务已就绪';
    refs.connectionBadge.textContent = '待连接';
    refs.connectionBadge.dataset.tone = 'warning';
    refs.connectionMeta.textContent = '确认平台地址后连接，Runner 将开始领取任务。';
    return;
  }

  refs.connectionTitle.textContent = running ? '本地服务正在启动' : 'Local Runner 尚未启动';
  refs.connectionBadge.textContent = running ? '启动中' : '未启动';
  refs.connectionBadge.dataset.tone = running ? 'warning' : 'danger';
  refs.connectionMeta.textContent = running
    ? '正在检查本地服务和浏览器依赖。'
    : '启动本地服务后即可连接平台。';
}

function applyTaskState({ connected, executing, currentRunId, currentTaskType, poller }) {
  refs.taskSection.dataset.active = executing ? 'true' : 'false';
  if (executing) {
    refs.taskTitle.textContent = taskTypeLabels[currentTaskType] || '正在执行平台任务';
    refs.taskState.textContent = '执行中';
    refs.taskTypeText.textContent = taskTypeLabels[currentTaskType] || currentTaskType || '自动化任务';
    refs.taskMetaText.textContent = `运行 ID：${currentRunId}`;
    return;
  }

  refs.taskTitle.textContent = connected ? '等待平台任务' : '尚未连接任务队列';
  refs.taskState.textContent = connected ? '空闲' : '未连接';
  refs.taskTypeText.textContent = connected ? 'Runner 已就绪' : '连接平台后开始工作';
  refs.taskMetaText.textContent = connected
    ? `已完成 ${poller?.completedCount || 0} 个任务，失败 ${poller?.failedCount || 0} 个。`
    : '任务创建、调度和历史记录均在平台侧管理。';
}

function applyCapabilities(capabilities) {
  const enabledCapabilities = capabilities.filter(item => item?.enabled !== false);
  refs.capabilityCount.textContent = `${enabledCapabilities.length} 项`;
  refs.capabilityList.replaceChildren();

  for (const item of enabledCapabilities) {
    const row = document.createElement('span');
    row.className = 'capability';
    row.textContent = item.label;
    row.style.setProperty('--capability-color', capabilityColors[item.key] || '#165dff');
    refs.capabilityList.appendChild(row);
  }
}

function formatRelativeTime(value) {
  if (!value) {
    return '-';
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return '-';
  }
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) {
    return '刚刚';
  }
  if (seconds < 60) {
    return `${seconds} 秒前`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function appendInlineLog(text) {
  const current = refs.logs.textContent && refs.logs.textContent !== '暂无日志' ? refs.logs.textContent : '';
  refs.logs.textContent = `${current}\n${new Date().toISOString()} ${text}`.trim();
}

async function refresh() {
  applyState(await api.getState());
}

for (const input of [refs.apiBaseUrlInput, refs.runnerNameInput, refs.portInput]) {
  input.addEventListener('input', () => { touched = true; });
}
refs.autoStartInput.addEventListener('change', () => { touched = true; });

refs.processBtn.addEventListener('click', () => runAction(refs.processBtn, () => (
  latestState?.process?.running ? api.stop() : api.start()
)));
refs.connectionBtn.addEventListener('click', () => runAction(refs.connectionBtn, async () => {
  if (latestState?.taskPoll?.poller?.running) {
    await api.disconnectPlatform();
    return;
  }
  await api.saveConfig(configFromForm());
  touched = false;
  await api.connectPlatform();
}));
refs.saveBtn.addEventListener('click', () => runAction(refs.saveBtn, async () => {
  await api.saveConfig(configFromForm());
  touched = false;
}));
refs.openLogsBtn.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  void api.openLogs();
});

api.onState((state) => applyState(state));
void refresh();
setInterval(() => { void refresh(); }, 3000);
