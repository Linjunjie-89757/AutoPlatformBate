<script setup lang="ts">
import { computed, toRefs } from 'vue'
import ApiCodeEditor from './ApiCodeEditor.vue'

const props = defineProps([
  'assertionConditionLabel',
  'assertionResultClass',
  'assertionResultLabel',
  'assertionTypeLabel',
  'backToCaseRunHistoryList',
  'bodyModes',
  'caseDetailAssertionPresentation',
  'caseDetailAssertionRows',
  'caseDetailBodyLanguage',
  'caseDetailBodyRawText',
  'caseDetailDrawerTab',
  'caseDetailPreviewStep',
  'caseDetailRequestTab',
  'caseDetailResponseBody',
  'caseDetailResponseBodyLanguage',
  'caseDetailResponseConsole',
  'caseDetailResponseDuration',
  'caseDetailResponseHeaders',
  'caseDetailResponseSize',
  'caseDetailResponseStatus',
  'caseDetailResponseTab',
  'caseDetailActualRequest',
  'caseHistoryAssertionRows',
  'caseHistoryConsole',
  'caseHistoryRequestBody',
  'caseHistoryRequestBodyLanguage',
  'caseHistoryRequestHeaders',
  'caseHistoryRequestTab',
  'caseHistoryResponseBody',
  'caseHistoryResponseBodyLanguage',
  'caseHistoryResponseHeaders',
  'caseHistoryResponseTab',
  'caseHistoryView',
  'caseRunHistories',
  'caseRunHistoryDetailErrorMessage',
  'caseRunHistoryDetailLoading',
  'caseRunHistoryErrorMessage',
  'caseRunHistoryLoading',
  'caseRunHistoryMeta',
  'caseRunHistoryTableHeight',
  'enabledRows',
  'formatCaseTags',
  'formatDateTime',
  'formatDuration',
  'formatFileSize',
  'formatResponseSize',
  'isRawBodyType',
  'openCaseRunHistorySecondaryDetail',
  'paramTypeOptions',
  'runResultClass',
  'runResultLabel',
  'selectedCaseHistoryStep',
  'selectedCaseRunHistoryDetail',
  'statusTone',
  'toPrettyJson',
  'viewingCaseDetail',
  'viewingCaseDetailErrorMessage',
  'viewingCaseDetailLoading',
  'viewingCaseItem',
])

const emit = defineEmits([
  'update:caseDetailDrawerTab',
  'update:caseDetailRequestTab',
  'update:caseDetailResponseTab',
  'update:caseHistoryRequestTab',
  'update:caseHistoryResponseTab',
])

const {
  assertionConditionLabel,
  assertionResultClass,
  assertionResultLabel,
  assertionTypeLabel,
  backToCaseRunHistoryList,
  bodyModes,
  caseDetailAssertionPresentation,
  caseDetailAssertionRows,
  caseDetailBodyLanguage,
  caseDetailBodyRawText,
  caseDetailDrawerTab,
  caseDetailPreviewStep,
  caseDetailRequestTab,
  caseDetailResponseBody,
  caseDetailResponseBodyLanguage,
  caseDetailResponseConsole,
  caseDetailResponseDuration,
  caseDetailResponseHeaders,
  caseDetailResponseSize,
  caseDetailResponseStatus,
  caseDetailResponseTab,
  caseDetailActualRequest,
  caseHistoryAssertionRows,
  caseHistoryConsole,
  caseHistoryRequestBody,
  caseHistoryRequestBodyLanguage,
  caseHistoryRequestHeaders,
  caseHistoryRequestTab,
  caseHistoryResponseBody,
  caseHistoryResponseBodyLanguage,
  caseHistoryResponseHeaders,
  caseHistoryResponseTab,
  caseHistoryView,
  caseRunHistories,
  caseRunHistoryDetailErrorMessage,
  caseRunHistoryDetailLoading,
  caseRunHistoryErrorMessage,
  caseRunHistoryLoading,
  caseRunHistoryMeta,
  caseRunHistoryTableHeight,
  enabledRows,
  formatCaseTags,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatResponseSize,
  isRawBodyType,
  openCaseRunHistorySecondaryDetail,
  paramTypeOptions,
  runResultClass,
  runResultLabel,
  selectedCaseHistoryStep,
  selectedCaseRunHistoryDetail,
  statusTone,
  toPrettyJson,
  viewingCaseDetail,
  viewingCaseDetailErrorMessage,
  viewingCaseDetailLoading,
  viewingCaseItem,
} = toRefs(props)

const setCaseDetailDrawerTab = (value: string) => emit('update:caseDetailDrawerTab', value)
const setCaseDetailRequestTab = (value: string) => emit('update:caseDetailRequestTab', value)
const setCaseDetailResponseTab = (value: string) => emit('update:caseDetailResponseTab', value)
const setCaseHistoryRequestTab = (value: string) => emit('update:caseHistoryRequestTab', value)
const setCaseHistoryResponseTab = (value: string) => emit('update:caseHistoryResponseTab', value)
const queryParamTypeOptions = computed(() =>
  ((paramTypeOptions?.value as string[] | undefined) || []).filter((item: string) => item !== 'file'),
)
</script>

<template>
<div class="api-case-drawer-tabs">
  <div class="ms-like-top-tabs case-drawer-view-tabs">
    <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'detail' }]" @click="setCaseDetailDrawerTab('detail')">详情</button>
    <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'history' }]" @click="setCaseDetailDrawerTab('history')">执行历史</button>
    <button :class="['ms-like-top-tab', { active: caseDetailDrawerTab === 'changes' }]" @click="setCaseDetailDrawerTab('changes')">变更历史</button>
  </div>
</div>

<div v-if="caseDetailDrawerTab === 'detail'" class="api-case-detail-panel" v-loading="viewingCaseDetailLoading">
      <div v-if="viewingCaseDetailErrorMessage" class="api-empty-body">{{ viewingCaseDetailErrorMessage }}</div>
      <template v-else-if="viewingCaseDetail">
        <div class="ms-like-top-tabs case-drawer-top-tabs">
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'headers' }]" @click="setCaseDetailRequestTab('headers')">请求头</button>
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'body' }]" @click="setCaseDetailRequestTab('body')">请求体</button>
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'params' }]" @click="setCaseDetailRequestTab('params')">
            Params
            <span v-if="enabledRows(viewingCaseDetail.requestConfig.queryParams).length" class="ms-like-tab-badge">{{ enabledRows(viewingCaseDetail.requestConfig.queryParams).length }}</span>
          </button>
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'auth' }]" @click="setCaseDetailRequestTab('auth')">Auth</button>
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'pre' }]" @click="setCaseDetailRequestTab('pre')">前置处理</button>
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'post' }]" @click="setCaseDetailRequestTab('post')">后置处理</button>
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'tests' }]" @click="setCaseDetailRequestTab('tests')">
            断言
            <span v-if="viewingCaseDetail.assertions.length" class="ms-like-tab-badge">{{ viewingCaseDetail.assertions.length }}</span>
          </button>
          <button :class="['ms-like-top-tab', { active: caseDetailRequestTab === 'settings' }]" @click="setCaseDetailRequestTab('settings')">设置</button>
        </div>

        <div class="api-request-body api-case-readonly-body">
          <template v-if="caseDetailRequestTab === 'headers'">
            <div class="api-param-table is-header is-readonly">
              <div class="api-param-header">
                <span class="api-drag-cell"></span>
                <span class="api-checkbox-cell"></span>
                <span class="api-header-title">参数名称</span>
                <span>参数值</span>
                <span>描述</span>
              </div>
              <div v-for="(row, index) in viewingCaseDetail.requestConfig.headers" :key="`case-header-${index}`" class="api-param-row">
                <span class="api-drag-cell"></span>
                <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                <el-input :model-value="row.key" disabled placeholder="参数名称" />
                <el-input :model-value="row.value" disabled placeholder="参数值" />
                <el-input :model-value="row.description" disabled placeholder="描述" />
              </div>
              <div v-if="!viewingCaseDetail.requestConfig.headers.length" class="api-empty-body">暂无请求头</div>
            </div>
          </template>

          <template v-else-if="caseDetailRequestTab === 'params'">
            <div class="api-param-table is-query is-readonly">
              <div class="api-param-header">
                <span class="api-drag-cell"></span>
                <span class="api-checkbox-cell"></span>
                <span class="api-header-title">Query 参数</span>
                <span class="api-type-header">类型</span>
                <span>参数值</span>
                <span class="api-length-header">长度范围</span>
                <span>编码</span>
                <span>描述</span>
              </div>
              <div v-for="(row, index) in viewingCaseDetail.requestConfig.queryParams" :key="`case-query-${index}`" class="api-param-row">
                <span class="api-drag-cell"></span>
                <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                <el-input :model-value="row.key" disabled placeholder="参数名称" />
                <div class="api-type-field">
                  <button type="button" :class="['api-required-button', { active: row.required }]" disabled>*</button>
                  <el-select :model-value="row.paramType" disabled>
                          <el-option v-for="type in queryParamTypeOptions" :key="type" :label="type" :value="type" />
                  </el-select>
                </div>
                <el-input :model-value="row.value" disabled placeholder="参数值" />
                <div class="api-length-range">
                  <el-input-number :model-value="row.minLength" :controls="false" disabled placeholder="最小" />
                  <span>-</span>
                  <el-input-number :model-value="row.maxLength" :controls="false" disabled placeholder="最大" />
                </div>
                <el-switch :model-value="row.encode" size="small" disabled />
                <el-input :model-value="row.description" disabled placeholder="描述" />
              </div>
              <div v-if="!viewingCaseDetail.requestConfig.queryParams.length" class="api-empty-body">暂无 Query 参数</div>
            </div>
          </template>

          <template v-else-if="caseDetailRequestTab === 'body'">
            <div class="api-body-section">
              <div class="api-body-modes">
                <button
                  v-for="mode in bodyModes"
                  :key="mode.value"
                  :class="['api-body-chip', { 'is-active': viewingCaseDetail.requestConfig.body.type === mode.value }]"
                  type="button"
                  disabled
                >
                  {{ mode.label }}
                </button>
              </div>
              <div :class="['api-body-editor', { 'is-empty': viewingCaseDetail.requestConfig.body.type === 'NONE', 'is-code': isRawBodyType(viewingCaseDetail.requestConfig.body.type) }]">
                <div v-if="viewingCaseDetail.requestConfig.body.type === 'NONE'" class="api-empty-body">请求没有 Body</div>
                <ApiCodeEditor
                  v-else-if="isRawBodyType(viewingCaseDetail.requestConfig.body.type)"
                  :model-value="caseDetailBodyRawText"
                  :language="caseDetailBodyLanguage"
                  read-only
                  :show-format-button="false"
                  height="300px"
                />
                <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(viewingCaseDetail.requestConfig.body.type)" class="api-param-table is-body-form is-readonly">
                  <div class="api-param-header">
                    <span class="api-drag-cell"></span>
                    <span class="api-checkbox-cell"></span>
                    <span class="api-header-title">参数名称</span>
                    <span class="api-type-header">类型</span>
                    <span>参数值</span>
                    <span class="api-length-header">长度范围</span>
                    <span>描述</span>
                  </div>
                  <div v-for="(row, index) in viewingCaseDetail.requestConfig.body.formItems" :key="`case-body-${index}`" class="api-param-row">
                    <span class="api-drag-cell"></span>
                    <span class="api-checkbox-cell"><el-checkbox :model-value="row.enabled !== false" disabled /></span>
                    <el-input :model-value="row.key" disabled placeholder="参数名称" />
                    <div class="api-type-field">
                      <button type="button" :class="['api-required-button', { active: row.required }]" disabled>*</button>
                      <el-select :model-value="row.paramType" disabled>
                        <el-option v-for="type in paramTypeOptions" :key="type" :label="type" :value="type" />
                      </el-select>
                    </div>
                    <el-input :model-value="row.fileName || row.value" disabled placeholder="参数值" />
                    <div class="api-length-range">
                      <el-input-number :model-value="row.minLength" :controls="false" disabled placeholder="最小" />
                      <span>-</span>
                      <el-input-number :model-value="row.maxLength" :controls="false" disabled placeholder="最大" />
                    </div>
                    <el-input :model-value="row.description" disabled placeholder="描述" />
                  </div>
                  <div v-if="!viewingCaseDetail.requestConfig.body.formItems.length" class="api-empty-body">暂无表单参数</div>
                </div>
                <div v-else class="api-binary-panel is-readonly">
                  <div class="api-binary-row">
                    <div class="api-binary-label">File</div>
                    <div class="api-binary-actions">
                      <button type="button" class="api-binary-pick" disabled>{{ viewingCaseDetail.requestConfig.body.fileName ? '重新选择' : '选择文件' }}</button>
                      <button type="button" class="api-binary-clear" disabled>清空</button>
                    </div>
                  </div>
                  <div class="api-binary-row">
                    <div class="api-binary-label">已选文件</div>
                    <div class="api-binary-selected">
                      <template v-if="viewingCaseDetail.requestConfig.body.fileName">
                        <span class="api-binary-file-name">{{ viewingCaseDetail.requestConfig.body.fileName }}</span>
                        <span v-if="viewingCaseDetail.requestConfig.body.fileSize" class="api-binary-file-size">{{ formatFileSize(viewingCaseDetail.requestConfig.body.fileSize) }}</span>
                      </template>
                      <template v-else>尚未选择二进制文件</template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="caseDetailRequestTab === 'auth'">
            <div class="api-auth-panel">
              <span class="api-form-label">认证方式</span>
              <el-radio-group :model-value="viewingCaseDetail.requestConfig.authConfig.authType" disabled>
                <el-radio-button value="NONE">No Auth</el-radio-button>
                <el-radio-button value="BASIC">Basic Auth</el-radio-button>
                <el-radio-button value="DIGEST">Digest Auth</el-radio-button>
              </el-radio-group>
              <div v-if="viewingCaseDetail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-grid">
                <label>Username</label>
                <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.basicAuth?.userName" class="api-auth-form-control" disabled />
                <label>Password</label>
                <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.basicAuth?.password ? '已配置' : ''" class="api-auth-form-control" disabled />
              </div>
              <div v-else-if="viewingCaseDetail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
                <label>Username</label>
                <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.digestAuth?.userName" class="api-auth-form-control" disabled />
                <label>Password</label>
                <el-input :model-value="viewingCaseDetail.requestConfig.authConfig.digestAuth?.password ? '已配置' : ''" class="api-auth-form-control" disabled />
              </div>
            </div>
          </template>

          <template v-else-if="caseDetailRequestTab === 'settings'">
            <div class="api-settings-panel is-readonly">
              <label>用例名称</label>
              <el-input :model-value="viewingCaseDetail.name" disabled />
              <label>所属接口</label>
              <el-input :model-value="viewingCaseDetail.definitionName" disabled />
              <label>标签</label>
              <el-input :model-value="formatCaseTags(viewingCaseDetail.tags)" disabled />
              <label>超时时间</label>
              <div class="api-settings-control-cell">
                <el-input-number :model-value="viewingCaseDetail.requestConfig.timeoutMs" class="api-settings-timeout-number" disabled />
              </div>
              <label>描述</label>
              <el-input :model-value="viewingCaseDetail.description || ''" type="textarea" :rows="4" disabled />
              <div class="api-settings-footer">
                <span>写入空间 {{ viewingCaseDetail.workspaceName || viewingCaseDetail.workspaceCode || '未选择' }}</span>
                <span>最近结果 {{ runResultLabel(viewingCaseDetail.lastRunResult) }}</span>
                <span>最后运行 {{ formatDateTime(viewingCaseDetail.lastRunAt) }}</span>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="request-section api-case-code-section">
              <ApiCodeEditor
                :model-value="caseDetailRequestTab === 'pre' ? toPrettyJson(viewingCaseDetail.preProcessors) : caseDetailRequestTab === 'post' ? toPrettyJson(viewingCaseDetail.postProcessors) : toPrettyJson(viewingCaseDetail.assertions)"
                language="json"
                read-only
                :show-format-button="false"
                fit-content
                :max-fit-content-height="1000"
                height="100%"
              />
            </div>
          </template>
        </div>

        <div class="ms-like-response-shell case-drawer-response-shell">
          <div class="ms-like-response-header">
            <div class="ms-like-response-title">响应内容</div>
            <div v-if="caseDetailPreviewStep" class="ms-like-response-metrics">
              <span v-if="caseDetailAssertionPresentation.visible" :class="['ms-like-result-pill', `is-${caseDetailAssertionPresentation.tone}`]">{{ caseDetailAssertionPresentation.label }}</span>
              <span :class="['ms-like-response-metric', `is-${statusTone(caseDetailResponseStatus)}`]">状态 {{ caseDetailResponseStatus ?? '-' }}</span>
              <span class="ms-like-response-metric">耗时 {{ caseDetailResponseDuration ?? '-' }}<template v-if="caseDetailResponseDuration !== null"> ms</template></span>
              <span>大小 {{ caseDetailResponseSize }}</span>
            </div>
          </div>
          <div v-if="!caseDetailPreviewStep" class="ms-like-response-empty">
            <div class="ms-like-response-empty-card">
              <div class="ms-like-response-empty-visual">
                <div class="ms-like-response-empty-window"><span></span><span></span><span></span></div>
              </div>
              <div class="ms-like-response-empty-text">点击 <span>执行</span> 获取响应内容</div>
            </div>
          </div>
          <template v-else>
            <div class="ms-like-response-tabs">
              <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'body' }]" @click="setCaseDetailResponseTab('body')">Body</button>
              <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'header' }]" @click="setCaseDetailResponseTab('header')">Header</button>
              <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'console' }]" @click="setCaseDetailResponseTab('console')">控制台</button>
              <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'actualRequest' }]" @click="setCaseDetailResponseTab('actualRequest')">实际请求</button>
              <button :class="['ms-like-top-tab', { active: caseDetailResponseTab === 'assertions' }]" @click="setCaseDetailResponseTab('assertions')">断言</button>
            </div>
            <div class="ms-like-response-body">
              <ApiCodeEditor
                v-if="caseDetailResponseTab === 'body'"
                :model-value="caseDetailResponseBody"
                :language="caseDetailResponseBodyLanguage"
                read-only
                :show-format-button="false"
                fit-content
                :max-fit-content-height="1000"
                height="100%"
              />
              <ApiCodeEditor
                v-else-if="caseDetailResponseTab === 'header'"
                :model-value="caseDetailResponseHeaders"
                language="json"
                read-only
                :show-format-button="false"
                fit-content
                :max-fit-content-height="1000"
                height="100%"
              />
              <ApiCodeEditor
                v-else-if="caseDetailResponseTab === 'console'"
                :model-value="caseDetailResponseConsole"
                language="api-console"
                read-only
                :show-format-button="false"
                fit-content
                :max-fit-content-height="1000"
                height="100%"
              />
              <ApiCodeEditor
                v-else-if="caseDetailResponseTab === 'actualRequest'"
                :model-value="caseDetailActualRequest"
                language="json"
                read-only
                :show-format-button="false"
                fit-content
                :max-fit-content-height="1000"
                height="100%"
              />
              <el-table v-else-if="caseDetailAssertionRows.length" :data="caseDetailAssertionRows" size="small" class="assertion-result-table">
                <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                </el-table-column>
                <el-table-column label="断言对象" width="96">
                  <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
                </el-table-column>
                <el-table-column label="条件" width="92">
                  <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                </el-table-column>
                <el-table-column label="期望值:" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                </el-table-column>
                <el-table-column label="实际值:" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                </el-table-column>
                <el-table-column label="结果" width="78">
                  <template #default="{ row }">
                    <span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                </el-table-column>
              </el-table>
              <div v-else class="api-empty-body">当前请求未配置断言</div>
            </div>
          </template>
        </div>
      </template>
      <div v-else class="api-empty-body">暂无用例详情</div>
    </div>

    <div v-else-if="caseDetailDrawerTab === 'history'" class="case-drawer-history-panel">
      <div v-if="caseRunHistoryErrorMessage" class="api-empty-body">{{ caseRunHistoryErrorMessage }}</div>
      <template v-else-if="caseHistoryView === 'list'">
        <div class="case-drawer-history-toolbar">
          <span class="case-drawer-history-limit-note">仅展示最近 10 次执行历史</span>
        </div>
        <div class="case-drawer-history-table-section" :style="{ height: `${caseRunHistoryTableHeight}px` }">
        <el-table
          v-loading="caseRunHistoryLoading"
          :data="caseRunHistories"
          size="small"
          class="case-drawer-history-table"
          :height="caseRunHistoryTableHeight"
          row-key="id"
          highlight-current-row
          @row-click="openCaseRunHistorySecondaryDetail"
        >
        <el-table-column label="执行时间" min-width="162" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="结果" width="78">
          <template #default="{ row }">
            <span :class="['case-drawer-history-result', runResultClass(row.result)]">{{ runResultLabel(row.result) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态码" width="78" align="center">
          <template #default="{ row }">{{ row.statusCode ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="92">
          <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
        </el-table-column>
        <el-table-column label="大小" width="92">
          <template #default="{ row }">{{ formatResponseSize(row.responseSize) }}</template>
        </el-table-column>
        <el-table-column label="环境" min-width="108" show-overflow-tooltip>
          <template #default="{ row }">{{ row.environmentName || '默认' }}</template>
        </el-table-column>
        <el-table-column label="变量集" min-width="108" show-overflow-tooltip>
          <template #default="{ row }">{{ row.variableSetName || '未选择' }}</template>
        </el-table-column>
        <el-table-column label="执行人" min-width="96" show-overflow-tooltip>
          <template #default="{ row }">{{ row.operator || '-' }}</template>
        </el-table-column>
        <template #empty>
          <div class="case-drawer-history-table-empty">暂无执行历史</div>
        </template>
        </el-table>
        </div>
      </template>

      <div v-else class="ms-like-response-shell case-drawer-history-detail-shell" v-loading="caseRunHistoryDetailLoading">
        <div class="case-drawer-history-detail-nav">
          <button type="button" class="case-drawer-history-back" @click="backToCaseRunHistoryList">← 执行历史</button>
          <span v-if="selectedCaseRunHistoryDetail" class="case-drawer-history-detail-time">{{ formatDateTime(selectedCaseRunHistoryDetail.createdAt) }}</span>
        </div>
        <div class="ms-like-response-header">
          <div class="ms-like-response-title">历史详情</div>
          <div v-if="selectedCaseRunHistoryDetail" class="ms-like-response-metrics">
            <span :class="['ms-like-result-pill', runResultClass(selectedCaseRunHistoryDetail.result)]">{{ runResultLabel(selectedCaseRunHistoryDetail.result) }}</span>
            <span class="ms-like-response-metric">状态 {{ selectedCaseRunHistoryDetail.statusCode ?? '-' }}</span>
            <span class="ms-like-response-metric">耗时 {{ formatDuration(selectedCaseRunHistoryDetail.durationMs) }}</span>
            <span>大小 {{ formatResponseSize(selectedCaseRunHistoryDetail.responseSize) }}</span>
          </div>
        </div>
        <div v-if="caseRunHistoryDetailErrorMessage" class="api-empty-body">{{ caseRunHistoryDetailErrorMessage }}</div>
        <div v-else-if="!selectedCaseRunHistoryDetail" class="api-empty-body">选择一条执行记录查看详情</div>
        <div v-else-if="!selectedCaseRunHistoryDetail.stepResults.length" class="api-empty-body">该历史暂无步骤详情</div>
          <div v-else class="case-drawer-history-section">
          <div class="case-drawer-history-meta">
            <span>执行环境 {{ caseRunHistoryMeta.environmentName }}</span>
            <span>变量集 {{ selectedCaseRunHistoryDetail.variableSetName || '未选择' }}</span>
            <span>执行人 {{ selectedCaseRunHistoryDetail.operator || '-' }}</span>
          </div>

          <div class="case-drawer-history-step">
            <div class="case-drawer-history-section-title">实际请求</div>
            <div class="case-drawer-history-request-summary">
              <span :class="['case-drawer-method-tag', `request-method-${String(selectedCaseHistoryStep?.request?.method || viewingCaseItem?.method || 'GET').toLowerCase()}`]">{{ selectedCaseHistoryStep?.request?.method || viewingCaseItem?.method || '-' }}</span>
              <span>{{ selectedCaseHistoryStep?.request?.url || viewingCaseItem?.path || '-' }}</span>
            </div>
            <div class="ms-like-response-tabs case-drawer-history-request-tabs">
              <button :class="['ms-like-top-tab', { active: caseHistoryRequestTab === 'header' }]" @click="setCaseHistoryRequestTab('header')">Header</button>
              <button :class="['ms-like-top-tab', { active: caseHistoryRequestTab === 'body' }]" @click="setCaseHistoryRequestTab('body')">Body</button>
            </div>
            <div class="ms-like-response-body case-drawer-history-request-body">
              <ApiCodeEditor
                v-if="caseHistoryRequestTab === 'header'"
                :model-value="caseHistoryRequestHeaders"
                language="json"
                read-only
                :show-format-button="false"
                fit-content
                :max-fit-content-height="1000"
                height="100%"
              />
              <ApiCodeEditor
                v-else
                :model-value="caseHistoryRequestBody"
                :language="caseHistoryRequestBodyLanguage"
                read-only
                :show-format-button="false"
                fit-content
                :max-fit-content-height="1000"
                height="100%"
              />
            </div>
          </div>

          <div class="case-drawer-history-step">
            <div class="case-drawer-history-section-title">响应结果</div>
            <div class="ms-like-response-tabs">
              <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'body' }]" @click="setCaseHistoryResponseTab('body')">Body</button>
              <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'header' }]" @click="setCaseHistoryResponseTab('header')">Header</button>
              <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'console' }]" @click="setCaseHistoryResponseTab('console')">控制台</button>
              <button :class="['ms-like-top-tab', { active: caseHistoryResponseTab === 'assertions' }]" @click="setCaseHistoryResponseTab('assertions')">断言</button>
            </div>
            <div class="ms-like-response-body">
            <ApiCodeEditor
              v-if="caseHistoryResponseTab === 'body'"
              :model-value="caseHistoryResponseBody"
              :language="caseHistoryResponseBodyLanguage"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="1000"
              height="100%"
            />
            <ApiCodeEditor
              v-else-if="caseHistoryResponseTab === 'header'"
              :model-value="caseHistoryResponseHeaders"
              language="json"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="1000"
              height="100%"
            />
            <ApiCodeEditor
              v-else-if="caseHistoryResponseTab === 'console'"
              :model-value="caseHistoryConsole"
              language="api-console"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="1000"
              height="100%"
            />
            <el-table v-else-if="caseHistoryAssertionRows.length" :data="caseHistoryAssertionRows" size="small" class="assertion-result-table">
              <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
              </el-table-column>
              <el-table-column label="断言对象" width="96">
                <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
              </el-table-column>
              <el-table-column label="条件" width="92">
                <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
              </el-table-column>
              <el-table-column label="期望值:" min-width="120" show-overflow-tooltip>
                <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
              </el-table-column>
              <el-table-column label="实际值:" min-width="120" show-overflow-tooltip>
                <template #default="{ row }">{{ row.actualValue || '-' }}</template>
              </el-table-column>
              <el-table-column label="结果" width="78">
                <template #default="{ row }">
                  <span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
              </el-table-column>
            </el-table>
            <div v-else class="api-empty-body">当前请求未配置断言</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="case-drawer-history-panel">
      <div class="api-empty-body">当前后端暂未提供接口用例变更历史接口，本轮不伪造变更记录。</div>
    </div>
</template>

<style scoped src="./styles/api-case-detail-drawer-content.css"></style>
