import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

import { isArtifactReference, resolveArtifactLocalPath } from './artifactManager.mjs';

const DEFAULT_PROTOCOL_VERSION = '1.0';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_CAPABILITIES = ['WEB_ELEMENT_VALIDATE', 'WEB_CASE_RUN', 'API_CASE_RUN', 'API_SCENARIO_RUN', 'API_SUITE_RUN'];
const DEFAULT_SCRIPT_TIMEOUT_MS = 1000;
const DEFAULT_MAX_RESOURCE_SLOTS = 5;
const MASK_REPLACEMENT = '******';
const DEFAULT_MASKING_RULES = [
  { ruleId: 'field_authorization', type: 'FIELD_NAME', pattern: 'authorization', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_proxy_authorization', type: 'FIELD_NAME', pattern: 'proxy-authorization', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_cookie', type: 'FIELD_NAME', pattern: 'cookie', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_set_cookie', type: 'FIELD_NAME', pattern: 'set-cookie', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_password', type: 'FIELD_NAME', pattern: 'password', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_passwd', type: 'FIELD_NAME', pattern: 'passwd', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_pwd', type: 'FIELD_NAME', pattern: 'pwd', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_token', type: 'FIELD_NAME', pattern: 'token', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_access_token', type: 'FIELD_NAME', pattern: 'access_token', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_refresh_token', type: 'FIELD_NAME', pattern: 'refresh_token', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_secret', type: 'FIELD_NAME', pattern: 'secret', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_credential', type: 'FIELD_NAME', pattern: 'credential', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_api_key', type: 'FIELD_NAME', pattern: 'api_key', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_apikey', type: 'FIELD_NAME', pattern: 'apikey', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_x_api_key', type: 'FIELD_NAME', pattern: 'x-api-key', replacement: MASK_REPLACEMENT },
  { ruleId: 'field_x_auth_token', type: 'FIELD_NAME', pattern: 'x-auth-token', replacement: MASK_REPLACEMENT },
  {
    ruleId: 'json_sensitive_field',
    type: 'REGEX',
    pattern: '("(?:password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|apikey)"\\s*:\\s*")[^"\\\\]*(")',
    replacement: '$1******$2',
    flags: 'gi',
  },
  {
    ruleId: 'url_sensitive_query',
    type: 'REGEX',
    pattern: '([?&](?:password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|apikey)=)[^&#\\s]+',
    replacement: '$1******',
    flags: 'gi',
  },
  { ruleId: 'bearer_authorization', type: 'REGEX', pattern: '(Bearer\\s+)[A-Za-z0-9._~+\\-/]+=*', replacement: '$1******', flags: 'gi' },
  { ruleId: 'basic_authorization', type: 'REGEX', pattern: '(Basic\\s+)[A-Za-z0-9+/=]+', replacement: '$1******', flags: 'gi' },
];

export function createRunnerTaskPoller(options = {}) {
  const runnerVersion = options.runnerVersion || '0.1.0';
  const defaultInstallId = options.defaultInstallId || 'web-ui-runner-local';
  const defaultMachineHint = options.machineHint || {};
  const webElementValidateExecutor = typeof options.webElementValidateExecutor === 'function'
    ? options.webElementValidateExecutor
    : null;
  const webCaseRunExecutor = typeof options.webCaseRunExecutor === 'function'
    ? options.webCaseRunExecutor
    : null;
  let poller;

  async function start(payload = {}) {
    const apiBaseUrl = normalizePlatformApiBaseUrl(payload.apiBaseUrl);
    if (!apiBaseUrl) {
      throw new Error('apiBaseUrl is required');
    }

    stop('replaced');
    poller = {
      apiBaseUrl,
      installId: optionalString(payload.installId) || defaultInstallId,
      runnerId: optionalString(payload.runnerId),
      runnerToken: optionalString(payload.runnerToken),
      runnerVersion: optionalString(payload.runnerVersion) || runnerVersion,
      protocolVersion: optionalString(payload.protocolVersion) || DEFAULT_PROTOCOL_VERSION,
      capabilities: normalizeCapabilities(payload.capabilities),
      workspaceCodes: Array.isArray(payload.workspaceCodes) ? payload.workspaceCodes : [],
      maxResourceSlots: normalizeResourceSlots(payload.maxResourceSlots ?? payload.maxSlots),
      webElementValidateExecutor: Boolean(webElementValidateExecutor),
      webCaseRunExecutor: Boolean(webCaseRunExecutor),
      intervalMs: normalizeIntervalMs(payload.intervalMs),
      running: true,
      tickRunning: false,
      startedAt: new Date().toISOString(),
      lastTickAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastMessage: '本地自动验证已启动',
      lastStoppedMessage: null,
      stoppedCount: 0,
      pulledCount: 0,
      completedCount: 0,
      failedCount: 0,
      sequenceNo: 0,
      timer: null,
      stoppedRunIds: new Set(),
    };

    if (!poller.runnerId || !poller.runnerToken) {
      await registerRunner(poller, defaultMachineHint);
    }
    schedule(0);
    return status();
  }

  function stop(reason = 'manual') {
    if (poller?.timer) {
      clearTimeout(poller.timer);
    }
    const previous = poller ? sanitize(poller) : null;
    poller = undefined;
    return {
      success: true,
      stopped: Boolean(previous),
      reason,
      poller: previous,
    };
  }

  function status() {
    return {
      success: true,
      poller: poller ? sanitize(poller) : null,
    };
  }

  function schedule(delayMs) {
    if (!poller?.running) {
      return;
    }
    poller.timer = setTimeout(() => {
      void tick();
    }, delayMs);
  }

  async function tick() {
    const current = poller;
    if (!current?.running || current.tickRunning) {
      return;
    }
    current.tickRunning = true;
    current.lastTickAt = new Date().toISOString();
    try {
      if (!current.runnerId || !current.runnerToken) {
        await registerRunner(current, defaultMachineHint);
      }
      const pulled = await postPlatformJson(current, '/public/local-runner/tasks/pull', {
        runnerId: current.runnerId,
        runnerToken: current.runnerToken,
        runnerVersion: current.runnerVersion,
        protocolVersion: current.protocolVersion,
        capabilities: current.capabilities,
        workspaceCodes: current.workspaceCodes,
        resource: buildRunnerResourceSnapshot(current),
      });

      current.lastSuccessAt = new Date().toISOString();
      if (!pulled?.hasTask || !pulled.task) {
        current.lastMessage = '暂无可领取任务';
        schedule(pulled?.pollIntervalMs || current.intervalMs);
        return;
      }

      current.pulledCount += 1;
      current.lastMessage = `已领取任务 ${pulled.task.runId}`;
      current.currentRunId = pulled.task.runId;
      current.currentTaskType = optionalString(pulled.task.taskType).toUpperCase() || null;
      current.lastTaskType = current.currentTaskType;
      const outcome = await executeTask(current, pulled.task);
      current.currentRunId = null;
      current.currentTaskType = null;
      if (outcome?.stopped) {
        current.stoppedCount += 1;
        current.lastSuccessAt = new Date().toISOString();
        current.lastStoppedMessage = outcome.message || `任务 ${pulled.task.runId} 已停止`;
        current.lastMessage = current.lastStoppedMessage;
      } else {
        current.completedCount += 1;
        current.lastSuccessAt = new Date().toISOString();
        current.lastMessage = `任务 ${pulled.task.runId} 已完成并回传结果`;
      }
      schedule(0);
    } catch (error) {
      if (poller === current) {
        current.failedCount += 1;
        current.lastError = error instanceof Error ? error.message : String(error);
        current.lastMessage = current.lastError;
        current.currentRunId = null;
        current.currentTaskType = null;
        schedule(current.intervalMs);
      }
    } finally {
      if (poller === current) {
        current.tickRunning = false;
      }
    }
  }

  async function executeTask(current, task) {
    const taskType = optionalString(task.taskType).toUpperCase();
    try {
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: taskType === 'WEB_ELEMENT_VALIDATE' ? 'VALIDATING' : 'EXECUTING',
        progress: { current: 0, total: 1, percent: 0 },
        message: 'Local Runner 已开始执行任务',
      });
      await appendLog(current, task, 'INFO', `开始执行 ${taskType || 'UNKNOWN'} 任务`, {
        validationMode: taskType === 'WEB_ELEMENT_VALIDATE' ? 'LOCAL_PLAYWRIGHT' : 'UNKNOWN',
        executionMode: taskType === 'WEB_CASE_RUN' ? 'LOCAL_PLAYWRIGHT' : 'UNKNOWN',
        apiMode: taskType === 'API_CASE_RUN' || taskType === 'API_SCENARIO_RUN' || taskType === 'API_SUITE_RUN' ? 'LOCAL_HTTP' : 'UNKNOWN',
      });

      if (taskType === 'WEB_ELEMENT_VALIDATE') {
        await withTaskTimeout(task, () => executeWebElementValidateTask(current, task));
        return { stopped: false };
      }

      if (taskType === 'WEB_CASE_RUN') {
        await withTaskTimeout(task, () => executeWebCaseRunTask(current, task));
        return { stopped: false };
      }

      if (taskType === 'API_CASE_RUN') {
        await withTaskTimeout(task, () => executeApiCaseRunTask(current, task));
        return { stopped: false };
      }

      if (taskType === 'API_SCENARIO_RUN') {
        await withTaskTimeout(task, () => executeApiScenarioRunTask(current, task));
        return { stopped: false };
      }

      if (taskType === 'API_SUITE_RUN') {
        await withTaskTimeout(task, () => executeApiSuiteRunTask(current, task));
        return { stopped: false };
      }

      await appendLog(current, task, 'WARN', `暂不支持的通用任务类型：${taskType || 'UNKNOWN'}`, {});
      await reportFinalResult(current, task, {
        status: 'FAILED',
        summary: {
          taskType,
          supported: false,
        },
        errorMessage: `Unsupported runner task type: ${taskType || 'UNKNOWN'}`,
        reportData: {},
      });
      return { stopped: false };
    } catch (error) {
      if (error instanceof RunnerTaskStoppedError) {
        return { stopped: true, message: error.message };
      }
      if (error instanceof RunnerTaskTimeoutError) {
        current.stoppedRunIds.add(task.runId);
        await reportFinalResult(current, task, {
          status: 'FAILED',
          durationMs: error.durationMs,
          summary: {
            mode: taskType === 'WEB_CASE_RUN' ? 'LOCAL_PLAYWRIGHT' : 'LOCAL_RUNNER',
            timeout: true,
          },
          errorMessage: error.message,
          reportData: {
            timeout: true,
            taskType,
          },
        });
        return { stopped: false };
      }
      throw error;
    }
  }

  async function executeWebElementValidateTask(current, task) {
    const locators = Array.isArray(task.payload?.locators) ? task.payload.locators : [];
    const startedAt = Date.now();

    try {
      if (!webElementValidateExecutor) {
        throw new Error('WEB_ELEMENT_VALIDATE executor is not configured');
      }
      const validation = await webElementValidateExecutor({
        task,
        locators,
      });
      const rawResults = Array.isArray(validation?.results) ? validation.results : [];
      const results = rawResults.map((result, index) => ({
        locatorId: locators[index]?.locatorId || locators[index]?.elementId || `locator-${index + 1}`,
        ...result,
      }));
      const passed = results.filter(item => item.validationStatus === 'PASSED').length;
      const failed = results.length - passed;
      const durationMs = Date.now() - startedAt;

      await reportStepResult(current, task, {
        stepId: 'web-element-validate-local',
        status: failed > 0 ? 'FAILED' : 'SUCCESS',
        durationMs,
        extra: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: results.length,
          passed,
          failed,
        },
      });
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'VALIDATING',
        progress: { current: results.length, total: results.length, percent: 100 },
        message: `本地页面验证完成：通过 ${passed} 个，失败 ${failed} 个`,
      });
      await reportFinalResult(current, task, {
        status: failed > 0 ? 'DEGRADED' : 'SUCCESS',
        durationMs,
        summary: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: results.length,
          passed,
          failed,
        },
        reportData: {
          validationMode: 'LOCAL_PLAYWRIGHT',
          pageUrl: validation?.page?.url || task.payload?.pageUrl || '',
          page: validation?.page || null,
          results,
        },
      });
    } catch (error) {
      if (error instanceof RunnerTaskStoppedError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;

      await appendLog(current, task, 'ERROR', 'WEB_ELEMENT_VALIDATE 本地页面验证失败', {
        errorMessage: message,
      });
      await reportStepResult(current, task, {
        stepId: 'web-element-validate-local',
        status: 'FAILED',
        durationMs,
        errorMessage: message,
        extra: {
          mode: 'LOCAL_PLAYWRIGHT',
        },
      });
      await reportFinalResult(current, task, {
        status: 'FAILED',
        durationMs,
        summary: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: locators.length,
          passed: 0,
          failed: locators.length,
        },
        errorMessage: message,
        reportData: {
          validationMode: 'LOCAL_PLAYWRIGHT',
          pageUrl: task.payload?.pageUrl || '',
          results: [],
        },
      });
    }
  }

  async function executeWebCaseRunTask(current, task) {
    const caseSnapshot = normalizeCaseSnapshot(task.payload);
    const steps = normalizeCaseSteps(caseSnapshot.steps);
    const startedAt = Date.now();
    const reportedStepIds = new Set();

    try {
      if (!webCaseRunExecutor) {
        throw new Error('WEB_CASE_RUN executor is not configured');
      }

      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'EXECUTING',
        progress: { current: 0, total: steps.length, percent: 0 },
        message: `本地用例执行开始：共 ${steps.length} 个步骤`,
      });

      const execution = await webCaseRunExecutor({
        task,
        environmentSnapshot: normalizeObject(task.environmentSnapshot),
        variableSnapshot: normalizeObject(task.variableSnapshot),
        caseSnapshot,
        steps,
        runOptions: task.payload?.runOptions || {},
        onStepResult: async (stepResult) => {
          const normalized = normalizeCaseStepResult(stepResult);
          reportedStepIds.add(normalized.stepId);
          const completed = reportedStepIds.size;
          await appendLog(current, task, normalized.status === 'SUCCESS' ? 'INFO' : 'ERROR', `步骤执行${normalized.status === 'SUCCESS' ? '成功' : '失败'}：${normalized.stepName || normalized.stepId}`, {
            stepType: normalized.stepType,
            errorMessage: normalized.errorMessage || null,
          });
          await reportStepResult(current, task, {
            stepId: normalized.stepId,
            status: normalized.status,
            durationMs: normalized.durationMs,
            errorMessage: normalized.errorMessage || null,
            screenshotRef: normalized.screenshotRef || null,
            extra: normalized.extra || {},
          });
          await reportStatus(current, task, {
            status: 'RUNNING',
            currentStage: 'EXECUTING',
            progress: buildProgress(completed, steps.length),
            message: `本地用例执行中：${completed}/${steps.length}`,
          });
        },
      });

      const rawStepResults = Array.isArray(execution?.stepResults) ? execution.stepResults : [];
      const stepResults = rawStepResults.map(normalizeCaseStepResult);
      for (const result of stepResults) {
        if (reportedStepIds.has(result.stepId)) {
          continue;
        }
        await reportStepResult(current, task, {
          stepId: result.stepId,
          status: result.status,
          durationMs: result.durationMs,
          errorMessage: result.errorMessage || null,
          screenshotRef: result.screenshotRef || null,
          extra: result.extra || {},
        });
      }

      const failed = stepResults.filter(item => item.status === 'FAILED').length;
      const skipped = stepResults.filter(item => item.status === 'SKIPPED').length;
      const passed = stepResults.filter(item => item.status === 'SUCCESS').length;
      const durationMs = Date.now() - startedAt;
      const finalStatus = failed > 0 ? 'FAILED' : 'SUCCESS';

      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'COMPLETED',
        progress: buildProgress(stepResults.length, steps.length),
        message: `本地用例执行完成：成功 ${passed} 步，失败 ${failed} 步`,
      });
      await reportFinalResult(current, task, {
        status: finalStatus,
        durationMs,
        summary: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: steps.length,
          passed,
          failed,
          skipped,
        },
        errorMessage: execution?.errorMessage || (failed > 0 ? 'Web UI case run failed' : null),
        reportData: {
          executionMode: 'LOCAL_PLAYWRIGHT',
          caseId: caseSnapshot.caseId ?? null,
          caseName: caseSnapshot.caseName || caseSnapshot.name || '',
          executionContext: buildCaseExecutionContext(task),
          page: execution?.page || null,
          stepResults,
        },
      });
    } catch (error) {
      if (error instanceof RunnerTaskStoppedError) {
        throw error;
      }
      const message = humanizeRunnerError(error);
      const durationMs = Date.now() - startedAt;
      const stepResults = buildFailedCaseStepResults(steps, message);

      await appendLog(current, task, 'ERROR', 'WEB_CASE_RUN 本地用例执行失败', {
        errorMessage: message,
      });
      for (const result of stepResults) {
        await reportStepResult(current, task, {
          stepId: result.stepId,
          status: result.status,
          durationMs: result.durationMs,
          errorMessage: result.errorMessage || null,
          screenshotRef: result.screenshotRef || null,
          extra: result.extra || {},
        });
      }
      await reportFinalResult(current, task, {
        status: 'FAILED',
        durationMs,
        summary: {
          mode: 'LOCAL_PLAYWRIGHT',
          total: steps.length,
          passed: 0,
          failed: stepResults.filter(item => item.status === 'FAILED').length,
          skipped: stepResults.filter(item => item.status === 'SKIPPED').length,
        },
        errorMessage: message,
        reportData: {
          executionMode: 'LOCAL_PLAYWRIGHT',
          caseId: caseSnapshot.caseId ?? null,
          caseName: caseSnapshot.caseName || caseSnapshot.name || '',
          executionContext: buildCaseExecutionContext(task),
          stepResults,
        },
      });
    }
  }

  async function executeApiCaseRunTask(current, task) {
    const apiCaseSnapshot = normalizeApiCaseSnapshot(task.payload);
    const startedAt = Date.now();
    try {
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'REQUESTING',
        progress: { current: 0, total: 1, percent: 0 },
        message: '本地接口用例执行开始',
      });
      const execution = await executeApiCaseRequest(task, apiCaseSnapshot, {});
      await reportStepResult(current, task, {
        stepId: 'api-request',
        status: execution.success ? 'SUCCESS' : 'FAILED',
        durationMs: execution.durationMs,
        errorMessage: execution.errorMessage || null,
        extra: {
          method: execution.request.method,
          url: execution.request.url,
          statusCode: execution.response.status,
          passedAssertions: execution.passedAssertions,
          failedAssertions: execution.failedAssertions,
        },
      });
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'COMPLETED',
        progress: { current: 1, total: 1, percent: 100 },
        message: execution.success ? '本地接口用例执行成功' : '本地接口用例执行失败',
      });
      await reportFinalResult(current, task, {
        status: execution.success ? 'SUCCESS' : 'FAILED',
        durationMs: Date.now() - startedAt,
        summary: {
          mode: 'LOCAL_HTTP',
          statusCode: execution.response.status,
          passedAssertions: execution.passedAssertions,
          failedAssertions: execution.failedAssertions,
        },
        errorMessage: execution.errorMessage || null,
        reportData: {
          executionMode: 'LOCAL_HTTP',
          caseId: apiCaseSnapshot.caseId ?? null,
          caseName: apiCaseSnapshot.caseName || '',
          request: execution.request,
          response: execution.response,
          assertions: execution.assertions,
          scriptResults: execution.scriptResults,
          extractedVariables: execution.scriptVariables,
        },
      });
    } catch (error) {
      if (error instanceof RunnerTaskStoppedError) {
        throw error;
      }
      const message = humanizeRunnerError(error);
      await reportFinalResult(current, task, {
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
        summary: {
          mode: 'LOCAL_HTTP',
          passedAssertions: 0,
          failedAssertions: 1,
        },
        errorMessage: message,
        reportData: {
          executionMode: 'LOCAL_HTTP',
          caseId: apiCaseSnapshot.caseId ?? null,
          caseName: apiCaseSnapshot.caseName || '',
        },
      });
    }
  }

  async function executeApiScenarioRunTask(current, task) {
    const scenarioSnapshot = normalizeApiScenarioSnapshot(task.payload);
    const steps = normalizeApiScenarioSteps(scenarioSnapshot.steps);
    const runOptions = normalizeObject(task.payload?.runOptions);
    const startedAt = Date.now();
    const runtimeVariables = {};

    try {
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'EXECUTING',
        progress: { current: 0, total: steps.length, percent: 0 },
        message: `本地接口场景执行开始：共 ${steps.length} 个步骤`,
      });

      const execution = await runApiScenarioSteps(current, task, {
        steps,
        runtimeVariables,
        runOptions,
        totalSteps: steps.length,
      });
      const stepResults = execution.stepResults;

      const failedSteps = stepResults.filter(item => item.status === 'FAILED').length;
      const passedSteps = stepResults.filter(item => item.status === 'SUCCESS').length;
      const finalStatus = failedSteps > 0 ? 'FAILED' : 'SUCCESS';
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'COMPLETED',
        progress: buildProgress(stepResults.length, steps.length),
        message: `本地接口场景执行完成：成功 ${passedSteps} 步，失败 ${failedSteps} 步`,
      });
      await reportFinalResult(current, task, {
        status: finalStatus,
        durationMs: Date.now() - startedAt,
        summary: {
          mode: 'LOCAL_HTTP',
          totalSteps: steps.length,
          passedSteps,
          failedSteps,
        },
        errorMessage: stepResults.find(item => item.status === 'FAILED')?.errorMessage || null,
        reportData: {
          executionMode: 'LOCAL_HTTP',
          scenarioId: scenarioSnapshot.scenarioId ?? null,
          scenarioName: scenarioSnapshot.scenarioName || '',
          stepResults,
          extractedVariables: runtimeVariables,
        },
      });
    } catch (error) {
      if (error instanceof RunnerTaskStoppedError) {
        throw error;
      }
      const message = humanizeRunnerError(error);
      await reportFinalResult(current, task, {
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
        summary: {
          mode: 'LOCAL_HTTP',
          totalSteps: steps.length,
          passedSteps: 0,
          failedSteps: Math.max(1, stepResults.filter(item => item.status === 'FAILED').length),
        },
        errorMessage: message,
        reportData: {
          executionMode: 'LOCAL_HTTP',
          scenarioId: scenarioSnapshot.scenarioId ?? null,
          scenarioName: scenarioSnapshot.scenarioName || '',
          stepResults,
          extractedVariables: runtimeVariables,
        },
      });
    }
  }

  async function executeApiSuiteRunTask(current, task) {
    const suiteSnapshot = normalizeApiSuiteSnapshot(task.payload);
    const items = normalizeApiSuiteItems(suiteSnapshot.items);
    const runOptions = normalizeObject(task.payload?.runOptions);
    const startedAt = Date.now();
    const runtimeVariables = {};
    const stepResults = [];
    const itemSnapshots = [];
    const totalSteps = items.reduce((total, item) => total + buildApiSuiteItemSteps(item).length, 0);

    try {
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'EXECUTING',
        progress: { current: 0, total: totalSteps, percent: 0 },
        message: `本地接口套件执行开始：共 ${items.length} 个条目`,
      });

      for (const [index, item] of items.entries()) {
        const itemStartedAt = Date.now();
        const itemSteps = buildApiSuiteItemSteps(item);
        const execution = await runApiScenarioSteps(current, task, {
          steps: itemSteps,
          runtimeVariables,
          runOptions,
          progressOffset: stepResults.length,
          totalSteps,
          stepIdPrefix: `suite-item-${item.itemId || index + 1}-`,
        });
        stepResults.push(...execution.stepResults);
        const itemFailed = execution.stepResults.some(result => result.status === 'FAILED');
        itemSnapshots.push({
          itemId: item.itemId ?? null,
          resourceId: item.resourceId ?? null,
          itemType: optionalString(item.itemType || item.type).toUpperCase() || 'UNKNOWN',
          itemName: item.itemName || item.name || '',
          sortOrder: Number(item.sortOrder || index + 1),
          result: itemFailed ? 'FAILED' : 'SUCCESS',
          totalCount: execution.stepResults.length,
          durationMs: Date.now() - itemStartedAt,
          failureSummary: execution.stepResults.find(result => result.status === 'FAILED')?.errorMessage || null,
        });
        if (itemFailed && runOptions.stopOnFirstFailure === true) {
          break;
        }
      }

      const failedSteps = stepResults.filter(item => item.status === 'FAILED').length;
      const passedSteps = stepResults.filter(item => item.status === 'SUCCESS').length;
      const finalStatus = failedSteps > 0 ? 'FAILED' : 'SUCCESS';
      await reportStatus(current, task, {
        status: 'RUNNING',
        currentStage: 'COMPLETED',
        progress: buildProgress(stepResults.length, totalSteps),
        message: `本地接口套件执行完成：成功 ${passedSteps} 步，失败 ${failedSteps} 步`,
      });
      await reportFinalResult(current, task, {
        status: finalStatus,
        durationMs: Date.now() - startedAt,
        summary: {
          mode: 'LOCAL_HTTP',
          totalSteps,
          passedSteps,
          failedSteps,
          totalItems: items.length,
          failedItems: itemSnapshots.filter(item => item.result === 'FAILED').length,
        },
        errorMessage: stepResults.find(item => item.status === 'FAILED')?.errorMessage || null,
        reportData: {
          executionMode: 'LOCAL_HTTP',
          suiteId: suiteSnapshot.suiteId ?? null,
          suiteName: suiteSnapshot.suiteName || '',
          itemSnapshots,
          stepResults,
          extractedVariables: runtimeVariables,
        },
      });
    } catch (error) {
      if (error instanceof RunnerTaskStoppedError) {
        throw error;
      }
      const message = humanizeRunnerError(error);
      await reportFinalResult(current, task, {
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
        summary: {
          mode: 'LOCAL_HTTP',
          totalSteps,
          passedSteps: 0,
          failedSteps: Math.max(1, stepResults.filter(item => item.status === 'FAILED').length),
          totalItems: items.length,
        },
        errorMessage: message,
        reportData: {
          executionMode: 'LOCAL_HTTP',
          suiteId: suiteSnapshot.suiteId ?? null,
          suiteName: suiteSnapshot.suiteName || '',
          itemSnapshots,
          stepResults,
          extractedVariables: runtimeVariables,
        },
      });
    }
  }

  async function runApiScenarioSteps(current, task, options) {
    const steps = normalizeApiScenarioSteps(options.steps);
    const runtimeVariables = normalizeObject(options.runtimeVariables);
    const runOptions = normalizeObject(options.runOptions);
    const progressOffset = Number(options.progressOffset || 0);
    const totalSteps = Number(options.totalSteps || steps.length);
    const stepIdPrefix = optionalString(options.stepIdPrefix);
    const stepResults = [];

    for (const [index, step] of steps.entries()) {
      const stepStartedAt = Date.now();
      const caseSnapshot = normalizeApiCaseSnapshot(step.caseSnapshot || step);
      const rawStepId = optionalString(step.stepId || step.id) || `api-step-${index + 1}`;
      const stepId = `${stepIdPrefix}${rawStepId}`;
      let execution;
      try {
        execution = await executeApiCaseRequest(task, caseSnapshot, runtimeVariables);
        const extracted = {
          ...extractApiVariables(caseSnapshot.extractors, execution.response),
          ...normalizeObject(execution.scriptVariables),
        };
        Object.assign(runtimeVariables, extracted);
        const stepResult = {
          stepId,
          stepName: caseSnapshot.caseName || step.name || rawStepId,
          status: execution.success ? 'SUCCESS' : 'FAILED',
          durationMs: Date.now() - stepStartedAt,
          errorMessage: execution.errorMessage || null,
          request: execution.request,
          response: execution.response,
          assertions: execution.assertions,
          extractedVariables: extracted,
          scriptResults: execution.scriptResults,
        };
        stepResults.push(stepResult);
        await reportStepResult(current, task, {
          stepId,
          status: stepResult.status,
          durationMs: stepResult.durationMs,
          errorMessage: stepResult.errorMessage,
          extra: {
            method: execution.request.method,
            url: execution.request.url,
            statusCode: execution.response.status,
            passedAssertions: execution.passedAssertions,
            failedAssertions: execution.failedAssertions,
            extractedVariables: extracted,
          },
        });
        await reportStatus(current, task, {
          status: 'RUNNING',
          currentStage: 'EXECUTING',
          progress: buildProgress(progressOffset + index + 1, totalSteps),
          message: `本地接口执行中：${progressOffset + index + 1}/${totalSteps}`,
        });
        if (!execution.success && (step.continueOnFailure !== true || runOptions.stopOnFirstFailure === true)) {
          break;
        }
      } catch (error) {
        if (error instanceof RunnerTaskStoppedError) {
          throw error;
        }
        const message = humanizeRunnerError(error);
        const stepResult = {
          stepId,
          stepName: caseSnapshot.caseName || step.name || rawStepId,
          status: 'FAILED',
          durationMs: Date.now() - stepStartedAt,
          errorMessage: message,
          request: null,
          response: null,
          assertions: [],
          extractedVariables: {},
        };
        stepResults.push(stepResult);
        await reportStepResult(current, task, {
          stepId,
          status: 'FAILED',
          durationMs: stepResult.durationMs,
          errorMessage: message,
          extra: {},
        });
        if (step.continueOnFailure !== true || runOptions.stopOnFirstFailure === true) {
          break;
        }
      }
    }

    return { stepResults, runtimeVariables };
  }

  async function registerRunner(current, machineHint) {
    const registered = await postPlatformJson(current, '/public/local-runner/register', {
      installId: current.installId,
      runnerVersion: current.runnerVersion,
      protocolVersion: current.protocolVersion,
      machineHint,
      capabilities: current.capabilities,
    });
    current.runnerId = registered.runnerId;
    current.runnerToken = registered.runnerToken;
    current.lastMessage = registered.message || 'Runner 已注册';
  }

  async function reportStatus(current, task, body) {
    if (current.stoppedRunIds?.has(task.runId)) {
      return null;
    }
    const safeBody = maskRunnerReportValue(body, task.maskingRules);
    return checkTaskAck(task, await postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/status`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      reportedAt: new Date().toISOString(),
      ...safeBody,
    }));
  }

  async function appendLog(current, task, level, message, data) {
    if (current.stoppedRunIds?.has(task.runId)) {
      return null;
    }
    current.sequenceNo += 1;
    const safeMessage = maskRunnerReportValue(message, task.maskingRules);
    const safeData = maskRunnerReportValue(data, task.maskingRules);
    return checkTaskAck(task, await postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/logs`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      sequenceNo: current.sequenceNo,
      level,
      message: safeMessage,
      data: safeData,
      timestamp: new Date().toISOString(),
    }));
  }

  async function reportStepResult(current, task, body) {
    if (current.stoppedRunIds?.has(task.runId)) {
      return null;
    }
    const safeBody = maskRunnerReportValue(body, task.maskingRules);
    return checkTaskAck(task, await postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/steps`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      ...safeBody,
    }));
  }

  async function reportFinalResult(current, task, body) {
    if (current.stoppedRunIds?.has(task.runId) && body?.status !== 'FAILED') {
      return null;
    }
    const safeBody = maskRunnerReportValue(body, task.maskingRules);
    return postPlatformJson(current, `/public/local-runner/tasks/${encodeURIComponent(task.runId)}/result`, {
      runnerId: current.runnerId,
      executionToken: task.executionToken,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      ...safeBody,
    });
  }

  return {
    start,
    stop,
    status,
  };
}

async function postPlatformJson(poller, path, body) {
  const response = await fetch(`${poller.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || text || `HTTP ${response.status}`;
    throw new Error(`平台任务接口请求失败：${message}`);
  }
  if (payload?.success === false) {
    throw new Error(payload.message || '平台任务接口返回失败');
  }
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function sanitize(value) {
  return {
    apiBaseUrl: value.apiBaseUrl,
    installId: value.installId,
    runnerId: value.runnerId || null,
    runnerVersion: value.runnerVersion,
    protocolVersion: value.protocolVersion,
    capabilities: value.capabilities,
    workspaceCodes: value.workspaceCodes,
    maxResourceSlots: value.maxResourceSlots,
    resource: buildRunnerResourceSnapshot(value),
    running: Boolean(value.running),
    tickRunning: Boolean(value.tickRunning),
    startedAt: value.startedAt,
    lastTickAt: value.lastTickAt,
    lastSuccessAt: value.lastSuccessAt,
    lastError: value.lastError,
    lastMessage: value.lastMessage,
    pulledCount: value.pulledCount || 0,
    completedCount: value.completedCount || 0,
    failedCount: value.failedCount || 0,
    stoppedCount: value.stoppedCount || 0,
    currentRunId: value.currentRunId || null,
    currentTaskType: value.currentTaskType || null,
    lastTaskType: value.lastTaskType || null,
    intervalMs: value.intervalMs,
    lastStoppedMessage: value.lastStoppedMessage || null,
  };
}

function normalizePlatformApiBaseUrl(value) {
  const text = optionalString(value).replace(/\/+$/, '');
  if (!text) {
    return '';
  }
  return text.endsWith('/api') ? text : `${text}/api`;
}

function normalizeCapabilities(value) {
  const capabilities = Array.isArray(value)
    ? value.map(optionalString).filter(Boolean)
    : DEFAULT_CAPABILITIES;
  return capabilities.length > 0 ? capabilities : DEFAULT_CAPABILITIES;
}

function normalizeIntervalMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1000, Math.min(numeric, 15000)) : DEFAULT_POLL_INTERVAL_MS;
}

function normalizeResourceSlots(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.max(1, Math.min(Math.floor(numeric), 64))
    : DEFAULT_MAX_RESOURCE_SLOTS;
}

export function buildRunnerResourceSnapshot(current) {
  const maxSlots = normalizeResourceSlots(current?.maxResourceSlots);
  const runningCost = current?.currentRunId ? estimateTaskResourceCost(current.currentTaskType) : 0;
  const usedSlots = Math.min(maxSlots, runningCost);
  return {
    mode: 'LOCAL_NODE_RUNNER',
    validationMode: current?.webElementValidateExecutor ? 'LOCAL_PLAYWRIGHT' : 'UNCONFIGURED',
    executionMode: current?.webCaseRunExecutor ? 'LOCAL_PLAYWRIGHT' : 'UNCONFIGURED',
    maxSlots,
    usedSlots,
    availableSlots: Math.max(0, maxSlots - usedSlots),
    runningRunIds: current?.currentRunId ? [current.currentRunId] : [],
  };
}

function estimateTaskResourceCost(taskType) {
  const normalized = optionalString(taskType).toUpperCase();
  if (normalized === 'WEB_ELEMENT_COLLECT' || normalized === 'WEB_ELEMENT_VALIDATE' || normalized === 'WEB_CASE_RUN') {
    return 5;
  }
  if (normalized === 'API_CASE_RUN' || normalized === 'API_SCENARIO_RUN' || normalized === 'API_SUITE_RUN') {
    return 1;
  }
  return 1;
}

function optionalString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function maskRunnerReportValue(value, maskingRules = []) {
  const rules = normalizeMaskingRules(maskingRules);
  rules.sensitiveLiterals = collectSensitiveLiterals(value, rules);
  return maskReportValue(value, rules, new WeakMap());
}

function maskReportValue(value, rules, seen) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return maskReportString(value, rules);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (Array.isArray(value)) {
    const masked = [];
    seen.set(value, masked);
    for (const item of value) {
      masked.push(maskReportValue(item, rules, seen));
    }
    return masked;
  }
  const masked = {};
  seen.set(value, masked);
  for (const [key, item] of Object.entries(value)) {
    const fieldRule = findFieldMaskingRule(key, rules.fieldRules);
    if (fieldRule) {
      masked[key] = fieldRule.replacement;
      continue;
    }
    masked[key] = maskReportValue(item, rules, seen);
  }
  return masked;
}

function maskReportString(value, rules) {
  let masked = value;
  for (const rule of rules.regexRules) {
    rule.regex.lastIndex = 0;
    masked = masked.replace(rule.regex, rule.replacement);
  }
  for (const literal of rules.sensitiveLiterals || []) {
    masked = masked.split(literal).join(MASK_REPLACEMENT);
  }
  return masked;
}

function collectSensitiveLiterals(value, rules) {
  const literals = new Set();
  collectSensitiveLiteralValues(value, rules, new WeakSet(), literals, false);
  return [...literals]
    .filter(item => item.length >= 4 && item !== MASK_REPLACEMENT)
    .sort((left, right) => right.length - left.length);
}

function collectSensitiveLiteralValues(value, rules, seen, literals, sensitiveScope) {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (sensitiveScope && text.length >= 4) {
      literals.add(text);
    }
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSensitiveLiteralValues(item, rules, seen, literals, sensitiveScope);
    }
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const fieldRule = findFieldMaskingRule(key, rules.fieldRules);
    collectSensitiveLiteralValues(item, rules, seen, literals, Boolean(fieldRule) || sensitiveScope);
  }
}

function normalizeMaskingRules(maskingRules) {
  const sourceRules = [
    ...DEFAULT_MASKING_RULES,
    ...(Array.isArray(maskingRules) ? maskingRules : []),
  ];
  const fieldRules = [];
  const regexRules = [];
  for (const rule of sourceRules) {
    if (!rule || typeof rule !== 'object' || rule.enabled === false) {
      continue;
    }
    const type = optionalString(rule.type).toUpperCase();
    const pattern = optionalString(rule.pattern || rule.fieldName || rule.name);
    if (!pattern) {
      continue;
    }
    const replacement = typeof rule.replacement === 'string' ? rule.replacement : MASK_REPLACEMENT;
    if (type === 'FIELD_NAME') {
      fieldRules.push({
        pattern,
        compactPattern: compactMaskingFieldName(pattern),
        replacement,
      });
      continue;
    }
    if (type === 'REGEX') {
      const regex = compileMaskingRegex(pattern, rule.flags);
      if (regex) {
        regexRules.push({ regex, replacement });
      }
    }
  }
  return { fieldRules, regexRules };
}

function compileMaskingRegex(pattern, flags) {
  const rawFlags = optionalString(flags) || 'g';
  const uniqueFlags = [];
  for (const flag of rawFlags) {
    if ('gimsuy'.includes(flag) && !uniqueFlags.includes(flag)) {
      uniqueFlags.push(flag);
    }
  }
  if (!uniqueFlags.includes('g')) {
    uniqueFlags.push('g');
  }
  try {
    return new RegExp(pattern, uniqueFlags.join(''));
  } catch {
    return null;
  }
}

function findFieldMaskingRule(key, fieldRules) {
  const text = optionalString(key).toLowerCase();
  const compact = compactMaskingFieldName(key);
  return fieldRules.find(rule => {
    const ruleText = rule.pattern.toLowerCase();
    return text === ruleText
      || compact === rule.compactPattern
      || Boolean(rule.compactPattern && compact.includes(rule.compactPattern));
  }) || null;
}

function compactMaskingFieldName(value) {
  return optionalString(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeCaseSnapshot(payload) {
  if (payload?.caseSnapshot && typeof payload.caseSnapshot === 'object') {
    return payload.caseSnapshot;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

function normalizeApiCaseSnapshot(payload) {
  if (payload?.apiCaseSnapshot && typeof payload.apiCaseSnapshot === 'object') {
    return payload.apiCaseSnapshot;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

function normalizeApiScenarioSnapshot(payload) {
  if (payload?.scenarioSnapshot && typeof payload.scenarioSnapshot === 'object') {
    return payload.scenarioSnapshot;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

function normalizeApiSuiteSnapshot(payload) {
  if (payload?.suiteSnapshot && typeof payload.suiteSnapshot === 'object') {
    return payload.suiteSnapshot;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeApiSuiteItems(value) {
  return Array.isArray(value)
    ? value
      .filter(item => item && typeof item === 'object')
      .filter(item => item.enabled !== false)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : [];
}

function normalizeApiScenarioSteps(value) {
  return Array.isArray(value)
    ? value
      .filter(step => step && typeof step === 'object')
      .filter(step => step.enabled !== false)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : [];
}

function buildApiSuiteItemSteps(item) {
  const itemType = optionalString(item?.itemType || item?.type).toUpperCase();
  if (itemType === 'SCENARIO') {
    const scenarioSnapshot = normalizeApiScenarioSnapshot(item);
    return normalizeApiScenarioSteps(scenarioSnapshot.steps);
  }
  const caseSnapshot = normalizeApiCaseSnapshot(item.caseSnapshot || item);
  return [{
    stepId: optionalString(item.itemId) || optionalString(caseSnapshot.caseId) || 'api-case',
    name: item.itemName || caseSnapshot.caseName || '',
    type: 'API_CASE',
    continueOnFailure: item.continueOnFailure === true,
    caseSnapshot,
  }];
}

async function executeApiCaseRequest(task, apiCaseSnapshot, runtimeVariables = {}) {
  const scriptResults = {};
  scriptResults.pre = runApiScript(apiCaseSnapshot.preScript || apiCaseSnapshot.beforeScript, {
    task,
    runtimeVariables,
    phase: 'pre',
  });
  const context = buildApiRenderContext(task, runtimeVariables);
  const request = await normalizeApiRequest(task, apiCaseSnapshot.request || {}, context);
  const startedAt = Date.now();
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(resolveApiRequestTimeoutMs(task)),
  });
  const responseBody = await response.text();
  const durationMs = Date.now() - startedAt;
  const responseHeaders = {};
  response.headers.forEach((value, name) => {
    responseHeaders[name] = value;
  });
  const assertions = evaluateApiAssertions(apiCaseSnapshot.assertions, {
    status: response.status,
    body: responseBody,
    headers: responseHeaders,
    durationMs,
  }, context);
  const normalizedResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: responseBody,
    durationMs,
  };
  const extractedVariables = extractApiVariables(apiCaseSnapshot.extractors, normalizedResponse);
  Object.assign(runtimeVariables, extractedVariables);
  scriptResults.post = runApiScript(apiCaseSnapshot.postScript || apiCaseSnapshot.afterScript, {
    task,
    runtimeVariables,
    phase: 'post',
    request,
    response: normalizedResponse,
  });
  const failedAssertions = assertions.filter(item => item.status === 'FAILED').length;
  const passedAssertions = assertions.filter(item => item.status === 'PASSED').length;
  return {
    success: failedAssertions === 0,
    durationMs,
    request,
    response: normalizedResponse,
    assertions,
    scriptResults,
    extractedVariables,
    scriptVariables: { ...runtimeVariables },
    passedAssertions,
    failedAssertions,
    errorMessage: failedAssertions > 0 ? assertions.find(item => item.status === 'FAILED')?.message || 'API assertions failed' : null,
  };
}

function buildApiRenderContext(task, runtimeVariables = {}) {
  const environment = normalizeObject(task.environmentSnapshot);
  const variableSnapshot = normalizeObject(task.variableSnapshot);
  const variables = normalizeObject(variableSnapshot.variables);
  return {
    ...environment,
    ...variables,
    ...normalizeObject(runtimeVariables),
  };
}

export function runApiScript(script, options = {}) {
  const source = optionalString(script);
  if (!source) {
    return { status: 'SKIPPED' };
  }
  assertSafeApiScriptSource(source);
  const runtimeVariables = normalizeObject(options.runtimeVariables);
  const result = {
    status: 'SUCCESS',
    phase: options.phase || 'unknown',
  };
  try {
    const sandbox = buildApiScriptSandbox({
      task: options.task,
      runtimeVariables,
      request: options.request,
      response: options.response,
    });
    vm.runInNewContext(source, sandbox, {
      timeout: resolveApiScriptTimeoutMs(options.task),
      displayErrors: true,
    });
    return result;
  } catch (error) {
    const message = humanizeRunnerError(error);
    throw new Error(`API ${result.phase}Script 执行失败：${message}`);
  }
}

function buildApiScriptSandbox(options = {}) {
  const runtimeVariables = normalizeObject(options.runtimeVariables);
  const renderContext = buildApiRenderContext(options.task || {}, runtimeVariables);
  const response = options.response || null;
  const logs = [];
  const variables = {
    get(name) {
      const key = optionalString(name);
      if (Object.prototype.hasOwnProperty.call(runtimeVariables, key)) {
        return runtimeVariables[key];
      }
      return resolveContextValue(renderContext, key);
    },
    set(name, value) {
      const key = optionalString(name);
      if (key) {
        runtimeVariables[key] = value === undefined || value === null ? '' : String(value);
      }
    },
    unset(name) {
      const key = optionalString(name);
      if (key) {
        delete runtimeVariables[key];
      }
    },
    toObject() {
      return { ...renderContext, ...runtimeVariables };
    },
  };
  const utils = {
    upper(value) {
      return String(value ?? '').toUpperCase();
    },
    lower(value) {
      return String(value ?? '').toLowerCase();
    },
    trim(value) {
      return String(value ?? '').trim();
    },
    jsonParse(value) {
      return JSON.parse(String(value ?? 'null'));
    },
    jsonStringify(value) {
      return JSON.stringify(value);
    },
    now() {
      return new Date().toISOString();
    },
  };
  return {
    variables,
    setVar(name, value) {
      variables.set(name, value);
    },
    getVar(name) {
      return variables.get(name);
    },
    removeVar(name) {
      variables.unset(name);
    },
    log(...args) {
      logs.push(args.map(item => {
        if (typeof item === 'string') {
          return item;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      }).join(' '));
    },
    fail(message) {
      throw new Error(message === undefined || message === null ? 'Script failed' : String(message));
    },
    request: freezePlainObject(options.request || {}),
    response: response ? buildApiScriptResponse(response) : null,
    utils,
    Function: undefined,
    eval: undefined,
    require: undefined,
    process: undefined,
    global: undefined,
    module: undefined,
    exports: undefined,
  };
}

function assertSafeApiScriptSource(source) {
  const unsafePatterns = [
    ['Function', /\bFunction\s*\(/],
    ['eval', /\beval\s*\(/],
    ['require', /\brequire\s*\(/],
    ['process', /\bprocess\s*[\[.]/],
    ['global', /\bglobal\s*[\[.]/],
    ['module', /\bmodule\s*[\[.]/],
    ['exports', /\bexports\s*[\[.]/],
    ['fs', /\bfs\s*[\[.]/],
    ['child_process', /\bchild_process\b/],
    ['constructor', /\bconstructor\s*[\[.]/],
    ['__dirname', /\b__dirname\b/],
    ['__filename', /\b__filename\b/],
  ];
  for (const [name, pattern] of unsafePatterns) {
    if (pattern.test(source)) {
      throw new Error(`${name} is not defined (blocked unsafe API script global)`);
    }
  }
}

function buildApiScriptResponse(response) {
  const body = String(response.body ?? '');
  return freezePlainObject({
    status: response.status,
    statusText: response.statusText,
    headers: freezePlainObject(response.headers || {}),
    body,
    durationMs: response.durationMs,
    text() {
      return body;
    },
    json() {
      return JSON.parse(body || 'null');
    },
  });
}

function freezePlainObject(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.freeze({ ...value });
}

async function normalizeApiRequest(task, request, context) {
  const method = optionalString(request.method).toUpperCase() || 'GET';
  const url = appendQueryParams(renderAnyTemplate(optionalString(request.url), context), request.queryParams, context);
  const headers = {};
  if (Array.isArray(request.headers)) {
    for (const header of request.headers) {
      if (!header || header.enabled === false) {
        continue;
      }
      const name = optionalString(header.name);
      if (!name) {
        continue;
      }
      headers[name] = renderAnyTemplate(String(header.value ?? ''), context);
    }
  }
  const normalizedBody = await normalizeApiRequestBody(task, request.body, context, headers);
  return {
    method,
    url,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : normalizedBody,
  };
}

async function normalizeApiRequestBody(task, body, context, headers) {
  if (body === null || body === undefined) {
    return null;
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const bodyType = optionalString(body.type).toUpperCase();
    if (bodyType === 'FORM_DATA' || bodyType === 'MULTIPART' || bodyType === 'MULTIPART_FORM_DATA') {
      removeContentTypeHeader(headers);
      return buildMultipartFormData(task, body.formItems, context);
    }
    const rawText = body.rawText ?? body.jsonText ?? body.xmlText ?? body.plainText ?? null;
    return rawText === null || rawText === undefined ? null : renderAnyTemplate(String(rawText), context);
  }
  return renderAnyTemplate(String(body), context);
}

async function buildMultipartFormData(task, formItems, context) {
  const formData = new FormData();
  for (const item of Array.isArray(formItems) ? formItems : []) {
    if (!item || item.enabled === false) {
      continue;
    }
    const key = optionalString(item.key || item.name);
    if (!key) {
      continue;
    }
    const value = renderAnyTemplate(String(item.value ?? ''), context);
    if (isArtifactReference(value)) {
      const fileId = value.replace(/^artifact:/i, '').trim();
      const localPath = resolveArtifactLocalPath(task, fileId);
      const buffer = await readFile(localPath);
      const blob = new Blob([buffer], {
        type: optionalString(item.contentType || item.mimeType) || 'application/octet-stream',
      });
      formData.append(key, blob, optionalString(item.fileName) || fileId);
      continue;
    }
    formData.append(key, value);
  }
  return formData;
}

function removeContentTypeHeader(headers) {
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'content-type') {
      delete headers[name];
    }
  }
}

function appendQueryParams(url, queryParams, context) {
  if (!Array.isArray(queryParams) || queryParams.length === 0) {
    return url;
  }
  const parsed = new URL(url);
  for (const param of queryParams) {
    if (!param || param.enabled === false) {
      continue;
    }
    const name = optionalString(param.name);
    if (!name) {
      continue;
    }
    parsed.searchParams.set(name, renderAnyTemplate(String(param.value ?? ''), context));
  }
  return parsed.toString();
}

function evaluateApiAssertions(assertions, response, context = {}) {
  const safeAssertions = Array.isArray(assertions) ? assertions : [];
  if (safeAssertions.length === 0) {
    return [{
      assertionId: 'status-2xx',
      type: 'STATUS_CODE_2XX',
      status: response.status >= 200 && response.status < 300 ? 'PASSED' : 'FAILED',
      message: response.status >= 200 && response.status < 300 ? null : `HTTP 状态码不是 2xx：${response.status}`,
    }];
  }
  return safeAssertions
    .filter(assertion => assertion && assertion.enabled !== false)
    .map((assertion, index) => evaluateApiAssertion(assertion, response, index, context));
}

function evaluateApiAssertion(assertion, response, index, context = {}) {
  const type = normalizeApiAssertionType(assertion);
  const expected = resolveApiAssertionExpected(assertion, context);
  const assertionId = optionalString(assertion.assertionId || assertion.id) || `assertion-${index + 1}`;
  if (type === 'STATUS_CODE' || type === 'RESPONSE_CODE') {
    const actual = String(response.status);
    const condition = normalizeApiAssertionCondition(assertion.condition || assertion.operator, 'EQUALS');
    return buildApiAssertionResult({
      assertionId,
      type: type === 'STATUS_CODE' ? 'STATUS_CODE' : 'RESPONSE_CODE',
      subject: 'statusCode',
      condition,
      expected,
      actual,
      comparison: compareApiAssertionValue(actual, condition, expected),
      failurePrefix: '状态码断言失败',
    });
  }
  if (type === 'RESPONSE_HEADER') {
    const subject = resolveApiAssertionSubject(assertion);
    const actual = subject ? String(response.headers[subject.toLowerCase()] ?? '') : '';
    const condition = normalizeApiAssertionCondition(assertion.condition || assertion.operator, 'EQUALS');
    return buildApiAssertionResult({
      assertionId,
      type,
      subject,
      condition,
      expected,
      actual,
      comparison: compareApiAssertionValue(actual, condition, expected),
      failurePrefix: '响应头断言失败',
    });
  }
  if (type === 'RESPONSE_BODY') {
    const subject = resolveApiAssertionSubject(assertion);
    const actualValue = subject.startsWith('$.')
      ? readSimpleJsonPath(parseJsonBody(response.body), subject)
      : response.body;
    const actual = formatApiAssertionActual(actualValue);
    const condition = normalizeApiAssertionCondition(assertion.condition || assertion.operator, 'EQUALS');
    return buildApiAssertionResult({
      assertionId,
      type,
      subject: subject || 'body',
      condition,
      expected,
      actual,
      comparison: compareApiAssertionValue(actual, condition, expected),
      failurePrefix: '响应体断言失败',
    });
  }
  if (type === 'BODY_CONTAINS') {
    const passed = response.body.includes(expected);
    return {
      assertionId,
      type,
      expected,
      status: passed ? 'PASSED' : 'FAILED',
      message: passed ? null : `响应体断言失败：未包含 ${expected}`,
    };
  }
  if (type === 'HEADER_EQUALS') {
    const headerName = optionalString(assertion.headerName || assertion.name).toLowerCase();
    const actual = headerName ? response.headers[headerName] : undefined;
    const passed = String(actual ?? '') === expected;
    return {
      assertionId,
      type,
      expected,
      actual: String(actual ?? ''),
      status: passed ? 'PASSED' : 'FAILED',
      message: passed ? null : `响应头断言失败：${headerName || '-'} 期望 ${expected}，实际 ${actual ?? '空'}`,
    };
  }
  if (type === 'JSON_EQUALS') {
    const expression = optionalString(assertion.expression || assertion.jsonPath);
    const actualValue = readSimpleJsonPath(parseJsonBody(response.body), expression);
    const actual = actualValue === undefined || actualValue === null ? '' : String(actualValue);
    const passed = actual === expected;
    return {
      assertionId,
      type,
      expected,
      actual,
      status: passed ? 'PASSED' : 'FAILED',
      message: passed ? null : `JSON 断言失败：${expression || '-'} 期望 ${expected}，实际 ${actual || '空'}`,
    };
  }
  if (type === 'RESPONSE_TIME' || type === 'RESPONSE_TIME_LESS_THAN') {
    const actualMs = Number(response.durationMs || 0);
    const condition = normalizeApiAssertionCondition(
      assertion.condition || assertion.operator,
      type === 'RESPONSE_TIME_LESS_THAN' ? 'LT' : 'LT_OR_EQUALS',
    );
    return buildApiAssertionResult({
      assertionId,
      type,
      subject: 'durationMs',
      condition,
      expected,
      actual: String(actualMs),
      comparison: compareApiAssertionValue(String(actualMs), condition, expected),
      failurePrefix: '响应耗时断言失败',
    });
  }
  return {
    assertionId,
    type: type || 'UNKNOWN',
    expected,
    status: 'FAILED',
    message: `暂不支持的接口断言类型：${type || 'UNKNOWN'}`,
  };
}

function buildApiAssertionResult(input) {
  const passed = input.comparison.passed;
  const message = passed ? null : `${input.failurePrefix}：${input.comparison.message}`;
  return {
    assertionId: input.assertionId,
    type: input.type,
    subject: input.subject,
    condition: input.condition,
    expected: input.expected,
    expectedValue: input.expected,
    actual: input.actual,
    actualValue: input.actual,
    status: passed ? 'PASSED' : 'FAILED',
    message,
  };
}

function normalizeApiAssertionType(assertion) {
  const type = optionalString(assertion.assertionType || assertion.type).toUpperCase();
  if (type === 'STATUS_CODE') {
    return 'STATUS_CODE';
  }
  if (type === 'RESPONSE_CODE') {
    return 'RESPONSE_CODE';
  }
  return type;
}

function resolveApiAssertionExpected(assertion, context = {}) {
  const value = assertion.expectedValue ?? assertion.expected ?? '';
  return renderAnyTemplate(String(value), context);
}

function resolveApiAssertionSubject(assertion) {
  return optionalString(
    assertion.subject
      || assertion.headerName
      || assertion.header
      || assertion.expression
      || assertion.jsonPath
      || assertion.name,
  );
}

function normalizeApiAssertionCondition(condition, fallback = 'EQUALS') {
  const normalized = optionalString(condition || fallback).toUpperCase();
  if (normalized === '=' || normalized === '==' || normalized === 'EQUAL') return 'EQUALS';
  if (normalized === '!=' || normalized === '<>' || normalized === 'NOT_EQUAL') return 'NOT_EQUALS';
  if (normalized === 'NOTCONTAINS') return 'NOT_CONTAINS';
  if (normalized === 'STARTS_WITH') return 'START_WITH';
  if (normalized === 'ENDS_WITH') return 'END_WITH';
  if (normalized === 'GTE' || normalized === '>=') return 'GT_OR_EQUALS';
  if (normalized === 'LTE' || normalized === '<=') return 'LT_OR_EQUALS';
  if (normalized === '>') return 'GT';
  if (normalized === '<') return 'LT';
  return normalized || 'EQUALS';
}

function compareApiAssertionValue(actual, condition, expected) {
  const safeActual = String(actual ?? '');
  const safeExpected = String(expected ?? '');
  try {
    switch (condition) {
      case 'UNCHECKED':
        return { passed: true, message: null };
      case 'EQUALS':
        return comparisonResult(safeActual === safeExpected, safeActual, safeExpected);
      case 'NOT_EQUALS':
        return comparisonResult(safeActual !== safeExpected, safeActual, safeExpected);
      case 'CONTAINS':
        return comparisonResult(safeActual.includes(safeExpected), safeActual, safeExpected);
      case 'NOT_CONTAINS':
        return comparisonResult(!safeActual.includes(safeExpected), safeActual, safeExpected);
      case 'EMPTY':
        return comparisonResult(safeActual.length === 0, safeActual, safeExpected);
      case 'NOT_EMPTY':
        return comparisonResult(safeActual.length > 0, safeActual, safeExpected);
      case 'START_WITH':
        return comparisonResult(safeActual.startsWith(safeExpected), safeActual, safeExpected);
      case 'END_WITH':
        return comparisonResult(safeActual.endsWith(safeExpected), safeActual, safeExpected);
      case 'REGEX':
        return comparisonResult(new RegExp(safeExpected, 's').test(safeActual), safeActual, safeExpected);
      case 'GT':
        return comparisonResult(compareApiAssertionNumber(safeActual, safeExpected) > 0, safeActual, safeExpected);
      case 'GT_OR_EQUALS':
        return comparisonResult(compareApiAssertionNumber(safeActual, safeExpected) >= 0, safeActual, safeExpected);
      case 'LT':
        return comparisonResult(compareApiAssertionNumber(safeActual, safeExpected) < 0, safeActual, safeExpected);
      case 'LT_OR_EQUALS':
        return comparisonResult(compareApiAssertionNumber(safeActual, safeExpected) <= 0, safeActual, safeExpected);
      default:
        return { passed: false, message: `暂不支持的断言条件 ${condition}` };
    }
  } catch (error) {
    return { passed: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function comparisonResult(passed, actual, expected) {
  return {
    passed,
    message: passed ? null : `期望 ${expected}，实际 ${actual}`,
  };
}

function compareApiAssertionNumber(actual, expected) {
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    throw new Error('实际值和期望值必须是数字');
  }
  return actualNumber === expectedNumber ? 0 : actualNumber > expectedNumber ? 1 : -1;
}

function formatApiAssertionActual(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function extractApiVariables(extractors, response) {
  const result = {};
  const safeExtractors = Array.isArray(extractors) ? extractors : [];
  if (safeExtractors.length === 0) {
    return result;
  }
  let jsonBody = null;
  for (const extractor of safeExtractors) {
    if (!extractor || extractor.enabled === false) {
      continue;
    }
    const name = optionalString(extractor.variableName || extractor.name);
    const type = normalizeApiExtractorType(extractor);
    const scope = normalizeApiExtractorScope(extractor);
    const expression = optionalString(extractor.expression);
    if (!name || (!expression && type !== 'STATUS_CODE')) {
      continue;
    }
    if (type === 'JSON_PATH' && scope === 'BODY') {
      if (jsonBody === null) {
        jsonBody = parseJsonBody(response.body);
      }
      const value = readSimpleJsonPath(jsonBody, expression);
      if (value !== undefined && value !== null) {
        result[name] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
    if (type === 'HEADER' || scope === 'RESPONSE_HEADERS') {
      const value = response.headers[expression.toLowerCase()];
      if (value !== undefined && value !== null) {
        result[name] = String(value);
      }
    }
    if (type === 'REGEX') {
      const source = scope === 'RESPONSE_CODE' ? String(response.status) : response.body;
      const match = source.match(new RegExp(expression));
      if (match) {
        result[name] = match[1] === undefined ? match[0] : match[1];
      }
    }
    if (type === 'STATUS_CODE' || scope === 'RESPONSE_CODE') {
      result[name] = String(response.status);
    }
  }
  return result;
}

function normalizeApiExtractorType(extractor) {
  const explicit = optionalString(extractor.type || extractor.extractType).toUpperCase();
  if (explicit) {
    return explicit;
  }
  const sourceType = optionalString(extractor.sourceType).toUpperCase();
  if (sourceType === 'BODY_JSONPATH') {
    return 'JSON_PATH';
  }
  if (sourceType === 'HEADER') {
    return 'HEADER';
  }
  if (sourceType === 'STATUS_CODE') {
    return 'STATUS_CODE';
  }
  return '';
}

function normalizeApiExtractorScope(extractor) {
  const explicit = optionalString(extractor.extractScope).toUpperCase();
  if (explicit) {
    return explicit;
  }
  const sourceType = optionalString(extractor.sourceType).toUpperCase();
  if (sourceType === 'HEADER') {
    return 'RESPONSE_HEADERS';
  }
  if (sourceType === 'STATUS_CODE') {
    return 'RESPONSE_CODE';
  }
  return 'BODY';
}

function parseJsonBody(body) {
  try {
    return JSON.parse(body || 'null');
  } catch {
    return null;
  }
}

function readSimpleJsonPath(value, expression) {
  const text = optionalString(expression);
  if (!text.startsWith('$.')) {
    return undefined;
  }
  const parts = text.slice(2).split('.').filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function renderAnyTemplate(value, context) {
  return String(value).replace(/\{\{\s*([\w.-]+)\s*}}|\$\{([^}]+)}/g, (match, mustacheKey, dollarKey) => {
    const key = optionalString(mustacheKey || dollarKey);
    if (!key) {
      return match;
    }
    const replacement = resolveContextValue(context, key);
    return replacement === undefined || replacement === null ? match : String(replacement);
  });
}

function resolveContextValue(context, key) {
  if (Object.prototype.hasOwnProperty.call(context, key)) {
    return context[key];
  }
  const parts = key.split('.').filter(Boolean);
  let current = context;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function resolveApiRequestTimeoutMs(task) {
  const timeoutPolicy = normalizeObject(task.timeoutPolicy);
  const numeric = Number(timeoutPolicy.requestTimeoutMs ?? timeoutPolicy.apiTimeoutMs ?? 30_000);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 30_000;
}

function resolveApiScriptTimeoutMs(task) {
  const timeoutPolicy = normalizeObject(task?.timeoutPolicy);
  const numeric = Number(timeoutPolicy.scriptTimeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_SCRIPT_TIMEOUT_MS;
}

function normalizeCaseSteps(value) {
  return Array.isArray(value)
    ? value
      .filter(step => step && typeof step === 'object')
      .filter(step => step.enabled !== false)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    : [];
}

function buildCaseExecutionContext(task) {
  const environment = normalizeObject(task.environmentSnapshot);
  const variableSnapshot = normalizeObject(task.variableSnapshot);
  const variables = normalizeObject(variableSnapshot.variables);
  return {
    environment: {
      environmentId: environment.environmentId ?? environment.id ?? null,
      environmentName: environment.environmentName || environment.name || null,
      baseUrl: environment.baseUrl || null,
      browserType: environment.browserType || null,
      headless: environment.headless ?? null,
      defaultTimeoutMs: environment.defaultTimeoutMs ?? null,
    },
    variableSetId: variableSnapshot.variableSetId ?? null,
    variableSetName: variableSnapshot.variableSetName || null,
    variableCount: Object.keys(variables).length,
  };
}

function normalizeCaseStepResult(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    stepId: optionalString(raw.stepId) || optionalString(raw.id) || 'step',
    stepName: optionalString(raw.stepName) || optionalString(raw.name) || '',
    stepType: optionalString(raw.stepType) || optionalString(raw.type) || '',
    status: optionalString(raw.status).toUpperCase() || 'UNKNOWN',
    durationMs: Number.isFinite(Number(raw.durationMs)) ? Number(raw.durationMs) : null,
    errorMessage: optionalString(raw.errorMessage) || null,
    screenshotRef: optionalString(raw.screenshotRef) || null,
    extra: raw.extra && typeof raw.extra === 'object' ? raw.extra : {},
  };
}

class RunnerTaskStoppedError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'RunnerTaskStoppedError';
    this.status = status;
  }
}

class RunnerTaskTimeoutError extends Error {
  constructor(message, durationMs) {
    super(message);
    this.name = 'RunnerTaskTimeoutError';
    this.durationMs = durationMs;
  }
}

function checkTaskAck(task, ack) {
  const status = optionalString(ack?.status).toUpperCase();
  if (status === 'CANCELED' || status === 'CANCELLED') {
    throw new RunnerTaskStoppedError(`任务 ${task.runId} 已被平台取消，Local Runner 已停止继续执行`, status);
  }
  return ack;
}

async function withTaskTimeout(task, executor) {
  const timeoutMs = resolveTaskTimeoutMs(task);
  if (!timeoutMs) {
    return executor();
  }
  const startedAt = Date.now();
  let timer;
  try {
    return await Promise.race([
      executor(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new RunnerTaskTimeoutError(`本地 Runner 任务执行超时：超过 ${timeoutMs} ms，已停止等待执行结果`, Date.now() - startedAt));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function resolveTaskTimeoutMs(task) {
  const timeoutPolicy = normalizeObject(task.timeoutPolicy);
  const value = timeoutPolicy.maxDurationMs ?? timeoutPolicy.taskTimeoutMs ?? task.taskTimeoutMs;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function buildFailedCaseStepResults(steps, message) {
  const safeSteps = Array.isArray(steps) ? steps : [];
  if (safeSteps.length === 0) {
    return [{
      stepId: 'case-run',
      stepName: '本地用例执行',
      stepType: 'UNKNOWN',
      status: 'FAILED',
      durationMs: 0,
      errorMessage: message,
      screenshotRef: null,
      extra: { sortOrder: 1 },
    }];
  }
  return safeSteps.map((step, index) => ({
    stepId: optionalString(step.stepId) || optionalString(step.id) || String(index + 1),
    stepName: optionalString(step.stepName) || optionalString(step.name) || `第 ${index + 1} 步`,
    stepType: optionalString(step.stepType) || optionalString(step.type) || '',
    status: index === 0 ? 'FAILED' : 'SKIPPED',
    durationMs: 0,
    errorMessage: index === 0 ? message : '前置步骤失败，当前步骤未执行',
    screenshotRef: null,
    extra: { sortOrder: Number(step.sortOrder || index + 1) },
  }));
}

function humanizeRunnerError(error) {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const message = rawMessage.trim() || '本地 Runner 执行失败';
  if (/page\.goto/i.test(message) && /Protocol error/i.test(message)) {
    return `目标页面打开失败：浏览器导航协议异常。请检查 URL 是否可访问、协议是否正确，原始错误：${message}`;
  }
  if (/net::ERR_NAME_NOT_RESOLVED/i.test(message)) {
    return `目标页面打开失败：域名无法解析。请检查本机网络、DNS 或目标环境配置，原始错误：${message}`;
  }
  if (/net::ERR_CONNECTION_REFUSED/i.test(message)) {
    return `目标页面打开失败：连接被拒绝。请确认目标服务已启动且本机可访问，原始错误：${message}`;
  }
  if (/Timeout/i.test(message)) {
    return `本地执行超时：页面加载或步骤等待超过限制。请检查页面响应速度、登录状态和定位器，原始错误：${message}`;
  }
  return message;
}

function buildProgress(current, total) {
  const safeTotal = Math.max(Number(total) || 0, 0);
  const safeCurrent = Math.max(Number(current) || 0, 0);
  return {
    current: safeCurrent,
    total: safeTotal,
    percent: safeTotal > 0 ? Math.min(100, Math.round((safeCurrent / safeTotal) * 100)) : 100,
  };
}
