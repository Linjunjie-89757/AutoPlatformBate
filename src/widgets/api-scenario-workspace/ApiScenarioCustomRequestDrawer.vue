<script setup lang="ts">
import { AlertCircle, AlertTriangle, ChevronDown, Globe, Play, RefreshCw, Save, X, XCircle } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { apiAutomationApi, type ApiRequestConfigInput, type ApiRunStepResult, type ApiScenarioStep } from '@/entities/api-automation'
import ApiCaseAdvancedEditor from '@/features/api-case-create-edit/ApiCaseAdvancedEditor.vue'
import { getRequestErrorMessage } from '@/shared/api/error'
import { AppDialog, AppDrawer, AppSwitch } from '@/shared/ui'

import ApiScenarioRequestBody from './ApiScenarioRequestBody.vue'
import ApiScenarioRequestRows from './ApiScenarioRequestRows.vue'
import {
  getRequestBodyText, isScenarioRawBody, normalizeScenarioRequestConfig,
} from './lib/apiScenarioStepRequestUtils'

const props = defineProps<{
  initialStep: ApiScenarioStep
  isNew: boolean
  workspaceCode: string
  environmentId: number | null
  variableSetId: number | null
}>()
const emit = defineEmits<{ close: []; save: [step: ApiScenarioStep] }>()

const tabs = ['Params', 'Auth', 'Headers', 'Cookies', 'Body', '前置处理', '后置处理', '断言', '设置'] as const
const responseTabs = ['响应体', 'Headers', 'Cookies', '断言结果'] as const
const authModes = [
  { value: 'NONE', label: 'No Auth' }, { value: 'BEARER', label: 'Bearer Token' },
  { value: 'BASIC', label: 'Basic Auth' }, { value: 'API_KEY', label: 'API Key' },
]
const initialStep = structuredClone(props.initialStep)
const draft = ref({
  ...initialStep,
  preProcessors: initialStep.preProcessors || [],
  postProcessors: initialStep.postProcessors || [],
  assertions: initialStep.assertions || [],
})
const request = ref(normalizeScenarioRequestConfig(draft.value.requestConfig))
request.value.connectTimeoutMs ??= 10000
request.value.followRedirects ??= true
request.value.authConfig.apiKeyLocation ??= 'header'
const methods = Array.from(new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', request.value.method]))
if (request.value.authConfig.authType === 'DIGEST') authModes.push({ value: 'DIGEST', label: 'Digest Auth' })
const activeTab = ref<typeof tabs[number]>('Params')
const responseTab = ref<typeof responseTabs[number]>('响应体')
const confirmClose = ref(false)
const error = ref('')
const uploadingBody = ref(false)
const bodyError = ref('')
const sending = ref(false)
const debugError = ref('')
const result = ref<ApiRunStepResult | null>(null)
const responsePanel = ref<HTMLElement | null>(null)
const rawAuth = computed(() => request.value.authConfig)
const credentials = computed(() => rawAuth.value.authType === 'DIGEST' ? rawAuth.value.digestAuth : rawAuth.value.basicAuth)
const snapshot = () => JSON.stringify([draft.value, request.value])
const initial = ref(snapshot())
onMounted(() => { initial.value = snapshot() })
watch(snapshot, () => { error.value = '' })
const dirty = computed(() => props.isNew || snapshot() !== initial.value)

const responseText = computed(() => {
  const value = result.value?.response?.body || ''
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
})
const responseSize = computed(() => {
  const bytes = new TextEncoder().encode(result.value?.response?.body || '').length
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
})
const responseHeaderRows = computed(() => Object.entries(result.value?.response?.headers || {}))
const responseCookie = computed(() => responseHeaderRows.value.find(([key]) => key.toLowerCase() === 'set-cookie')?.[1] || '')

function tryClose() {
  if (dirty.value) confirmClose.value = true
  else emit('close')
}

function enabledRows(value: unknown) {
  const rows: unknown[] = Array.isArray(value) ? value : []
  return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .filter(row => row.enabled !== false)
}

function validate(): string {
  if (uploadingBody.value) return '正在读取文件，请稍候。'
  if (!draft.value.stepName.trim()) return '请输入步骤名称。'
  if (!request.value.path.trim()) return '请输入请求地址。'
  if (request.value.timeoutMs <= 0 || !Number.isFinite(request.value.timeoutMs)) return '响应超时必须大于 0 ms。'
  if ((request.value.connectTimeoutMs ?? 0) < 1000 || !Number.isFinite(request.value.connectTimeoutMs)) return '连接超时至少为 1000 ms。'
  if (bodyError.value) return `${bodyError.value}。`
  const { body, queryParams, headers, cookies } = request.value
  const formItems = body.type === 'FORM_DATA' || body.type === 'FORM_URLENCODED' ? body.formItems : []
  if ([...queryParams, ...headers, ...cookies, ...formItems].some(row => row.enabled !== false && !row.key?.trim() && (row.value?.trim() || row.description?.trim() || row.fileName))) {
    return '请为已填写的参数补全名称。'
  }
  if (body.type === 'BINARY' && !body.fileName) return '请选择二进制请求体文件。'
  if (body.type === 'FORM_DATA' && formItems.some(row => row.enabled !== false && row.key?.trim() && row.paramType === 'file' && !row.fileName)) return '请选择表单文件。'
  for (const processor of enabledRows([...draft.value.preProcessors, ...draft.value.postProcessors])) {
    if (!String(processor.name || '').trim()) return '请填写处理器名称。'
    if (processor.processorType === 'SCRIPT' && !String(processor.script || '').trim()) return '请输入处理器脚本。'
    if (processor.processorType === 'SQL' && (!processor.dataSourceId || !String(processor.script || '').trim())) return '请为 SQL 处理器选择数据源并填写 SQL。'
    if (processor.processorType === 'TIME_WAITING' && !(Number(processor.delayMs) >= 1 && Number(processor.delayMs) <= 600000)) return '等待处理器时长须在 1–600000 ms 之间。'
    if (processor.processorType === 'EXTRACT' && enabledRows(processor.extractors).some(row => !String(row.variableName || '').trim() || !String(row.expression || '').trim())) return '请填写提取变量名和提取表达式。'
  }
  for (const assertion of enabledRows(draft.value.assertions)) {
    if (!String(assertion.name || '').trim()) return '请填写断言名称。'
    if (assertion.assertionType === 'RESPONSE_CODE' && !String(assertion.expectedValue ?? '').trim()) return '请输入期望状态码。'
    if (assertion.assertionType === 'RESPONSE_HEADER' && enabledRows(assertion.assertions).some(row => !String(row.header || '').trim())) return '请填写断言的响应头名称。'
    if (assertion.assertionType === 'VARIABLE' && enabledRows(assertion.variableAssertionItems).some(row => !String(row.variableName || '').trim())) return '请填写断言变量名。'
    if (assertion.assertionType === 'RESPONSE_TIME' && !(Number(assertion.expectedValue) >= 0)) return '响应时间不能小于 0 ms。'
    if (assertion.assertionType === 'RESPONSE_BODY') {
      const group = assertion.assertionBodyType === 'REGEX' ? assertion.regexAssertion : assertion.assertionBodyType === 'X_PATH' ? assertion.xpathAssertion : assertion.jsonPathAssertion
      const expressions = enabledRows((group as { assertions?: unknown[] } | undefined)?.assertions)
      if (!expressions.length || expressions.some(row => !String(row.expression || '').trim())) return '请至少填写一条完整的响应体断言表达式。'
    }
    if (assertion.assertionType === 'SCRIPT' && !String(assertion.script || '').trim()) return '请输入断言脚本。'
  }
  return ''
}

function buildStep(): ApiScenarioStep & { requestConfig: ApiRequestConfigInput } {
  const step = JSON.parse(JSON.stringify(draft.value)) as ApiScenarioStep
  const config = JSON.parse(JSON.stringify(request.value)) as typeof request.value
  config.path = config.path.trim()
  config.queryParams = config.queryParams.filter(row => row.key?.trim())
  config.headers = config.headers.filter(row => row.key?.trim())
  config.cookies = config.cookies.filter(row => row.key?.trim())
  config.body.formItems = config.body.formItems.filter(row => row.key?.trim())
  if (isScenarioRawBody(config.body.type)) config.body.rawText = getRequestBodyText(config.body)
  return { ...step, stepName: step.stepName.trim(), requestConfig: config }
}

function saveStep() {
  error.value = validate()
  if (!error.value) emit('save', buildStep())
}

async function sendDebug() {
  if (sending.value) return
  error.value = validate() || (props.workspaceCode === 'ALL' ? '请先切换到具体工作空间后再发送请求。' : '')
  if (error.value) return
  const step = buildStep()
  sending.value = true
  debugError.value = ''
  result.value = null
  responseTab.value = '响应体'
  try {
    const response = await apiAutomationApi.debugRunDefinitionDraft(props.workspaceCode, {
      workspaceCode: props.workspaceCode,
      name: step.stepName,
      requestConfig: step.requestConfig,
      assertions: step.assertions || [],
      preProcessors: step.preProcessors || [],
      postProcessors: step.postProcessors || [],
      tags: [], extractors: [],
      environmentId: props.environmentId,
      variableSetId: props.variableSetId,
    })
    result.value = response.stepResults[0] || null
    if (!result.value?.response) debugError.value = result.value?.errorMessage || response.failureSummary || '请求未返回响应。'
  } catch (cause) {
    debugError.value = getRequestErrorMessage(cause)
  } finally {
    sending.value = false
    await nextTick()
    responsePanel.value?.scrollIntoView({ block: 'nearest' })
  }
}
</script>

<template>
  <AppDrawer
    :model-value="true"
    :title="isNew ? '新建自定义请求' : '配置自定义请求'"
    size="720px"
    variant="standard"
    drawer-class="scenario-custom-request-drawer"
    modal-class="scenario-custom-request-overlay"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @update:model-value="tryClose"
  >
    <template #header>
      <div class="scenario-request__heading">
        <span class="scenario-request__icon"><Globe :size="17" aria-hidden="true" /></span>
        <div><h3>{{ isNew ? '新建自定义请求' : '配置自定义请求' }}</h3><p>配置自定义 HTTP 请求</p></div>
        <button type="button" class="scenario-request__close" aria-label="关闭" @click="tryClose"><X :size="16" /></button>
      </div>
    </template>

    <div class="scenario-request">
      <section class="scenario-request__card scenario-request__padded">
        <label for="scenario-request-name" class="scenario-request__label">步骤名称 <em>*</em></label>
        <input id="scenario-request-name" v-model="draft.stepName" class="scenario-request__input" placeholder="请输入步骤名称" />
      </section>
      <section class="scenario-request__card">
        <div class="scenario-request__padded scenario-request__address">
          <label for="scenario-request-url" class="scenario-request__label">请求地址 <em>*</em></label>
          <div class="scenario-request__address-row">
            <div class="scenario-request__method" :class="`is-${request.method.toLowerCase()}`">
              <select v-model="request.method" class="scenario-request__input" aria-label="请求方法"><option v-for="method in methods" :key="method">{{ method }}</option></select>
              <ChevronDown :size="13" aria-hidden="true" />
            </div>
            <input id="scenario-request-url" v-model="request.path" class="scenario-request__input scenario-request__path" placeholder="/api/orders" @keydown.enter="sendDebug" />
            <button type="button" class="scenario-request__send" :disabled="sending || uploadingBody" @click="sendDebug">
              <RefreshCw v-if="sending" :size="12" class="scenario-request__spin" /><Play v-else :size="12" />{{ sending ? '发送中' : '发送' }}
            </button>
          </div>
        </div>
        <nav class="scenario-request__tabs" role="tablist" aria-label="请求配置">
          <button v-for="tab in tabs" :key="tab" type="button" role="tab" :aria-selected="activeTab === tab" @click="activeTab = tab">{{ tab }}</button>
        </nav>
        <div class="scenario-request__padded" role="tabpanel" :aria-label="activeTab">
          <ApiScenarioRequestBody
            v-show="activeTab === 'Body'"
            v-model="request.body"
            v-model:uploading="uploadingBody"
            @validation="bodyError = $event"
          />
          <ApiScenarioRequestRows v-if="activeTab === 'Params'" v-model="request.queryParams" label="参数" />
          <ApiScenarioRequestRows v-else-if="activeTab === 'Headers'" v-model="request.headers" label="Header" />
          <ApiScenarioRequestRows v-else-if="activeTab === 'Cookies'" v-model="request.cookies" label="Cookie" />
          <template v-else-if="activeTab === 'Auth'">
            <div class="scenario-request__options is-auth">
              <button v-for="mode in authModes" :key="mode.value" type="button" :data-auth-mode="mode.value" :aria-pressed="rawAuth.authType === mode.value" @click="rawAuth.authType = mode.value">{{ mode.label }}</button>
            </div>
            <p v-if="rawAuth.authType === 'NONE'" class="scenario-request__empty">不使用认证</p>
            <label v-else-if="rawAuth.authType === 'BEARER'"><span class="scenario-request__label">Token</span><input v-model="rawAuth.bearerToken" class="scenario-request__input" placeholder="{{token}}" /></label>
            <div v-else-if="(rawAuth.authType === 'BASIC' || rawAuth.authType === 'DIGEST') && credentials" class="scenario-request__fields">
              <label><span class="scenario-request__label">用户名</span><input v-model="credentials.userName" class="scenario-request__input" /></label>
              <label><span class="scenario-request__label">密码</span><input v-model="credentials.password" class="scenario-request__input" type="password" /></label>
            </div>
            <div v-else-if="rawAuth.authType === 'API_KEY'" class="scenario-request__fields is-three">
              <label><span class="scenario-request__label">Key</span><input v-model="rawAuth.apiKeyName" class="scenario-request__input" /></label>
              <label><span class="scenario-request__label">Value</span><input v-model="rawAuth.apiKeyValue" class="scenario-request__input" /></label>
              <label><span class="scenario-request__label">添加到</span><select v-model="rawAuth.apiKeyLocation" class="scenario-request__input"><option value="header">Header</option><option value="query">Query</option></select></label>
            </div>
          </template>
          <div v-else-if="activeTab === '设置'" class="scenario-request__fields is-settings">
            <label><span class="scenario-request__label">响应超时 (ms)</span><input v-model.number="request.timeoutMs" class="scenario-request__input" type="number" min="1" /></label>
            <label><span class="scenario-request__label">连接超时 (ms)</span><input v-model.number="request.connectTimeoutMs" class="scenario-request__input" type="number" min="1000" /></label>
            <div class="scenario-request__redirect"><div><strong>跟随重定向</strong><small>自动跟随服务端返回的 3xx 跳转</small></div><AppSwitch :model-value="request.followRedirects !== false" label="跟随重定向" @update:model-value="request.followRedirects = $event" /></div>
          </div>
          <div v-show="activeTab === '前置处理'"><ApiCaseAdvancedEditor v-model="draft.preProcessors" kind="processor" stage="pre" scenario-request :workspace-code="workspaceCode" /></div>
          <div v-show="activeTab === '后置处理'"><ApiCaseAdvancedEditor v-model="draft.postProcessors" kind="processor" stage="post" scenario-request :workspace-code="workspaceCode" :latest-response-body="result?.response?.body || ''" /></div>
          <div v-show="activeTab === '断言'"><ApiCaseAdvancedEditor v-model="draft.assertions" kind="assertion" scenario-request :workspace-code="workspaceCode" :latest-response-body="result?.response?.body || ''" /></div>
        </div>

        <section v-if="sending || debugError || result" ref="responsePanel" class="scenario-request__response scenario-request__padded" aria-label="调试响应">
          <div v-if="sending" class="scenario-request__debug-state" role="status"><RefreshCw :size="15" class="scenario-request__spin" />正在发送请求…</div>
          <div v-else-if="debugError" class="scenario-request__debug-state is-error" role="alert"><XCircle :size="24" /><span>{{ debugError }}</span><button type="button" @click="sendDebug">重新发送</button></div>
          <template v-else-if="result?.response">
            <div class="scenario-request__response-head">
              <span class="scenario-request__status" :class="{ 'is-error': result.response.statusCode >= 400 }">{{ result.response.statusCode }}{{ result.response.statusCode === 200 ? ' OK' : '' }}</span>
              <span>{{ result.durationMs }} ms · {{ responseSize }}</span>
              <div class="scenario-request__response-tabs"><button v-for="tab in responseTabs" :key="tab" type="button" :aria-pressed="responseTab === tab" @click="responseTab = tab">{{ tab }}</button></div>
            </div>
            <p v-if="result.errorMessage" class="scenario-request__validation" role="status">{{ result.errorMessage }}</p>
            <pre v-if="responseTab === '响应体'">{{ responseText || '暂无响应体' }}</pre>
            <dl v-else-if="responseTab === 'Headers'" class="scenario-request__headers"><div v-for="[key, value] in responseHeaderRows" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></div><div v-if="!responseHeaderRows.length">暂无响应头</div></dl>
            <p v-else-if="responseTab === 'Cookies'" class="scenario-request__cookie">{{ responseCookie || '当前响应暂无 Cookies' }}</p>
            <ul v-else class="scenario-request__assertions">
              <li v-if="!result.assertionResults.length">暂无断言结果</li>
              <li v-for="(item, index) in result.assertionResults" :key="index" :class="item.success ? 'is-pass' : 'is-error'"><strong>{{ item.success ? '通过' : '失败' }} · {{ item.name || item.type }}</strong><span>{{ item.message || item.actualValue || '' }}</span></li>
            </ul>
          </template>
        </section>
      </section>
      <div v-if="error" class="scenario-request__error" role="alert"><AlertCircle :size="14" />{{ error }}</div>
    </div>

    <template #footer>
      <span class="scenario-request__footer-status">{{ dirty ? '存在未保存的修改' : '所有修改已保存' }}</span>
      <button type="button" class="scenario-request__cancel" @click="tryClose">取消</button>
      <button type="button" class="scenario-request__save" :disabled="uploadingBody" @click="saveStep"><Save :size="13" />{{ isNew ? '保存并添加' : '保存修改' }}</button>
    </template>
  </AppDrawer>

  <AppDialog v-model="confirmClose" title="放弃未保存的修改？" width="400px" variant="standard" dialog-class="scenario-request-discard-dialog" modal-class="scenario-request-discard-overlay" align-center :show-close="false">
    <div class="scenario-request__discard">
      <span><AlertTriangle :size="17" /></span>
      <div><h4>放弃未保存的修改？</h4><p>关闭后，本次填写的配置将不会保留。</p></div>
    </div>
    <div class="scenario-request__discard-actions">
      <button type="button" class="scenario-request__cancel" @click="confirmClose = false">继续编辑</button>
      <button type="button" class="scenario-request__save is-danger" @click="emit('close')">放弃修改</button>
    </div>
  </AppDialog>
</template>

<style scoped>
:global(.el-overlay.scenario-custom-request-overlay) { background: rgb(29 33 41 / 38%); }
:global(.el-drawer.scenario-custom-request-drawer) { border-left: 1px solid #e5e6eb; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%); font-family: Inter, "Noto Sans SC", sans-serif; }
:global(.el-drawer.scenario-custom-request-drawer > .el-drawer__header) { margin: 0; padding: 16px 20px; border-bottom-color: #e5e6eb; }
:global(.el-drawer.scenario-custom-request-drawer .app-drawer__footer) { height: 61px; padding: 14px 20px; }
.scenario-request__heading { display: flex; min-width: 0; align-items: center; gap: 12px; font-family: Inter, "Noto Sans SC", sans-serif; }
.scenario-request__heading h3 { margin: 0; color: #1d2129; font-size: 15px; font-weight: 600; line-height: 22.5px; }
.scenario-request__heading p { margin: 2px 0 0; color: #86909c; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.scenario-request__icon { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 10px; background: #e8f3ff; color: #165dff; }
.scenario-request__close { display: grid; width: 32px; height: 32px; place-items: center; margin-left: auto; padding: 0; border: 0; border-radius: 10px; background: transparent; color: #86909c; }
.scenario-request__close:hover { background: #f2f3f5; }
.scenario-request { box-sizing: border-box; width: 100%; min-height: 0; flex: 1; overflow: auto; padding: 20px; background: #fafbfe; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.scenario-request button, .scenario-request__close, .scenario-request__cancel, .scenario-request__save { cursor: pointer; }
.scenario-request button:disabled, .scenario-request__save:disabled { cursor: not-allowed; opacity: .65; }
.scenario-request__card { min-width: 0; overflow: hidden; border: 1px solid #e5e6eb; border-radius: 14px; background: #fff; }
.scenario-request__card + .scenario-request__card { margin-top: 16px; }
.scenario-request__padded { padding: 16px; }
.scenario-request__label { display: block; margin-bottom: 6px; color: #4e5969; font-size: 12px; font-weight: 500; line-height: 18px; }
.scenario-request__label em { color: #f53f3f; font-style: normal; }
.scenario-request__input { box-sizing: border-box; width: 100%; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid #e5e6eb; border-radius: 8px; background-color: #fff; color: #1d2129; font: inherit; }
.scenario-request__input:focus { border-color: #165dff; outline: none; }
.scenario-request__address { border-bottom: 1px solid #e5e6eb; }
.scenario-request__address-row { display: flex; min-width: 0; gap: 8px; }
.scenario-request__method { position: relative; width: 100px; flex: 0 0 100px; color: #165dff; }
.scenario-request__method.is-get { color: #00b42a; }
.scenario-request__method.is-put { color: #ff7d00; }
.scenario-request__method.is-delete { color: #f53f3f; }
.scenario-request__method.is-patch { color: #7816ff; }
.scenario-request__method select { appearance: none; padding: 0 26px 0 14px; color: inherit; font-weight: 700; }
.scenario-request__method svg { position: absolute; top: 10px; right: 5px; pointer-events: none; }
.scenario-request__path { flex: 1; font-family: ui-monospace, Consolas, monospace; }
.scenario-request__send, .scenario-request__save, .scenario-request__cancel { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; white-space: nowrap; }
.scenario-request__send { height: 34px; padding: 0 16px; border: 0; border-radius: 10px; background: #00b42a; color: #fff; }
.scenario-request__send:not(:disabled):hover { background: #009a29; }
.scenario-request__tabs { display: flex; overflow-x: auto; padding: 0 12px; border-bottom: 1px solid #e5e6eb; }
.scenario-request__tabs button { height: 36px; flex: none; padding: 0 12px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #86909c; font: inherit; white-space: nowrap; }
.scenario-request__tabs button[aria-selected="true"] { border-color: #165dff; color: #165dff; }
.scenario-request__options { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.scenario-request__options.is-auth { margin-bottom: 16px; }
.scenario-request__options button { height: 28px; padding: 0 10px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #86909c; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; }
.scenario-request__options.is-auth button { height: 32px; flex: none; padding: 0 12px; border-radius: 10px; font-size: 11px; line-height: 16.5px; }
.scenario-request__options button[data-auth-mode="NONE"] { min-width: 69px; }
.scenario-request__options button[data-auth-mode="BEARER"] { min-width: 96px; }
.scenario-request__options button[data-auth-mode="BASIC"] { min-width: 83px; }
.scenario-request__options button[data-auth-mode="API_KEY"] { min-width: 66px; }
.scenario-request__options button[aria-pressed="true"] { border-color: #165dff; background: #e8f3ff; color: #165dff; }
.scenario-request__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.scenario-request__fields.is-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.scenario-request__fields.is-settings { gap: 16px; }
.scenario-request__redirect { display: flex; grid-column: 1 / -1; align-items: center; justify-content: space-between; padding: 12px; border: 1px solid #e5e6eb; border-radius: 10px; }
.scenario-request__redirect strong { color: #1d2129; font-weight: 500; }
.scenario-request__redirect small { display: block; color: #86909c; font-size: 11px; }
.scenario-request__error { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 12px; border-radius: 8px; background: #fff0f0; color: #f53f3f; }
.scenario-request__response { border-top: 1px solid #e5e6eb; background: #fafbfe; }
.scenario-request__response-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 12px; color: #86909c; font-size: 11px; }
.scenario-request__status { padding: 2px 8px; border-radius: 4px; background: #e8ffea; color: #00b42a; font-weight: 700; }
.scenario-request__status.is-error { background: #ffeeee; color: #f53f3f; }
.scenario-request__response-tabs { display: flex; gap: 4px; margin-left: auto; }
.scenario-request__response-tabs button { padding: 4px 8px; border: 0; border-radius: 4px; background: transparent; color: #86909c; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; white-space: nowrap; }
.scenario-request__response-tabs button[aria-pressed="true"] { background: #e8f3ff; color: #165dff; }
.scenario-request__response pre { max-height: 150px; margin: 0; overflow: auto; padding: 12px; border-radius: 8px; background: #101827; color: #dde7f4; font: 400 11px/16.5px ui-monospace, Consolas, monospace; }
.scenario-request__headers, .scenario-request__assertions, .scenario-request__cookie { margin: 0; padding: 0; overflow-wrap: anywhere; list-style: none; }
.scenario-request__headers div, .scenario-request__assertions li { display: flex; gap: 8px; padding: 3px 0; }
.scenario-request__headers dd { margin: 0; }
.scenario-request__assertions .is-pass { color: #00b42a; }
.scenario-request__debug-state { display: flex; min-height: 96px; align-items: center; justify-content: center; gap: 8px; color: #86909c; }
.scenario-request__debug-state.is-error { flex-direction: column; }
.scenario-request__debug-state button { padding: 0; border: 0; background: transparent; color: #165dff; font: inherit; }
.scenario-request__debug-state.is-error, .scenario-request__assertions .is-error { color: #f53f3f; }
.scenario-request__spin { animation: scenario-request-spin 1s linear infinite; }
@keyframes scenario-request-spin { to { transform: rotate(360deg); } }
.scenario-request__footer-status { margin-right: auto; color: #c9cdd4; font-size: 11px; }
.scenario-request__cancel { height: 28px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; color: #4e5969; }
.scenario-request__cancel:hover { background: #f4f6fa; }
.scenario-request__save { height: 32px; padding: 0 14px; border: 0; border-radius: 10px; background: #165dff; color: #fff; font-size: 13px; }
.scenario-request__save:hover { background: #0e42d2; }
.scenario-request__save.is-danger { background: #f53f3f; }
:global(.el-overlay.scenario-request-discard-overlay) { background: rgb(29 33 41 / 48%); }
:global(.el-dialog.scenario-request-discard-dialog) { max-width: calc(100% - 32px); border-radius: 16px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%); }
:global(.el-dialog.scenario-request-discard-dialog > .el-dialog__header) { display: none; }
:global(.el-dialog.scenario-request-discard-dialog > .el-dialog__body) { padding: 20px; }
.scenario-request__discard { display: flex; align-items: flex-start; gap: 12px; }
.scenario-request__discard span { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 50%; background: #fff3e8; color: #ff7d00; }
.scenario-request__discard h4 { margin: 0; color: #1d2129; font-size: 14px; font-weight: 600; }
.scenario-request__discard p { margin: 4px 0 0; color: #86909c; font-size: 12px; line-height: 20px; }
.scenario-request__discard-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 20px; }
</style>
