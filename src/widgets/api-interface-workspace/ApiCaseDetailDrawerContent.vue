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

<style scoped>
.api-editor-tab:hover,
.api-editor-tab.is-active {
  background: #fff;
  color: var(--app-text-primary);
}

.api-editor-tab.is-active {
  border-bottom-color: var(--app-warning);
  box-shadow: 0 -1px 0 #fff inset;
}

.api-editor-tab.is-active .api-editor-tab__close {
  background: transparent;
  color: #667085;
  opacity: 0.42;
}

.api-response-tabs button.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.api-response-tabs button:not(.is-active):hover {
  color: var(--app-text-secondary);
}

.api-response-tabs button.is-active::after {
  content: none;
}

.api-request-body {
  min-height: 0;
  flex: 0 0 auto;
  overflow: visible;
  padding: 10px 12px 12px;
  border-bottom: 0;
  background: #ffffff;
}

.api-request-body.is-params,
.api-request-body.is-headers {
  min-height: 320px;
  flex-basis: 320px;
}

.api-request-body.is-pre,
.api-request-body.is-post,
.api-request-body.is-tests {
  min-height: 360px;
  flex: 0 0 auto;
  overflow: visible;
}

.api-request-body.is-settings {
  min-height: 320px;
  flex: 0 0 auto;
  overflow: visible;
}

.api-request-body.is-cases {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden auto;
  padding: 12px;
}

.api-request-body.is-definition {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden auto;
  padding: 12px 12px 16px;
}

.api-param-table {
  min-height: 296px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-param-header,
.api-param-row {
  display: grid;
  width: 100%;
  min-width: 100%;
  grid-template-columns: 24px 32px 240px 150px 240px 200px 80px minmax(220px, 1fr) 90px;
  align-items: center;
  gap: 0;
  padding: 2px 10px 2px 0;
}

.api-param-table.is-header .api-param-header,
.api-param-table.is-header .api-param-row {
  min-width: 100%;
  grid-template-columns: 24px 32px repeat(3, minmax(0, 1fr)) 80px;
}

.api-param-table.is-body-form .api-param-header,
.api-param-table.is-body-form .api-param-row {
  min-width: 100%;
  grid-template-columns: 24px 32px 240px 150px 240px 200px minmax(220px, 1fr) 90px;
}

.api-param-header {
  box-sizing: border-box;
  height: 36px;
  min-height: 36px;
  padding: 0 10px 0 0;
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.api-param-row {
  min-height: 38px;
  border-bottom: 1px solid var(--app-border-soft);
  transition: background-color 0.15s ease;
}

.api-param-row:hover {
  background: #fafbff;
}

.api-definition-view-switch button:hover,
.api-definition-view-switch button.is-active {
  color: var(--app-primary);
}

.api-definition-status-tabs button.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-drag-cell,
.api-checkbox-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.api-param-row:hover .api-drag-dot {
  background: #9ca3af;
}

.api-header-title {
  display: inline-flex;
  align-items: center;
  padding-left: 0;
}

.api-type-header {
  padding-left: 30px;
}

.api-length-header {
  padding-left: 22px;
}

.api-type-field {
  display: grid;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

.api-required-button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.api-required-button.active {
  background: #fff1f3;
  color: #f04438;
}

.api-param-row:last-of-type {
  border-bottom: 0;
}

.api-param-row :deep(.el-input__wrapper),
.api-param-row :deep(.el-select__wrapper),
.api-param-row :deep(.el-input-number) {
  min-height: 28px;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
}

.api-param-row :deep(.el-input) {
  height: 30px;
}

.api-param-row :deep(.el-input__wrapper) {
  height: 30px;
}

.api-param-row :deep(.el-input__wrapper:hover),
.api-param-row :deep(.el-select__wrapper:hover) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #d0d5dd;
}

.api-param-row :deep(.el-input.is-focus .el-input__wrapper),
.api-param-row :deep(.el-select.is-focus .el-select__wrapper),
.api-param-row :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6;
}

.api-param-row :deep(.el-input__inner),
.api-param-row :deep(.el-select__placeholder),
.api-param-row :deep(.el-select__selected-item) {
  font-size: 12px;
}

.api-length-range {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-length-range :deep(.el-input-number) {
  width: 100%;
}

.api-length-range :deep(.el-input-number__increase),
.api-length-range :deep(.el-input-number__decrease) {
  display: none;
}

.api-length-range :deep(.el-input-number .el-input__wrapper) {
  padding: 0 8px;
}

.api-body-section {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.api-body-modes {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
}

.api-body-chip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text-muted);
  cursor: pointer;
  font-family: Arial, sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.api-body-chip.is-active {
  border-color: #3b82f6;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-body-editor {
  min-height: 0;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-body-editor.is-code {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-body-editor:not(.is-code) {
  min-height: 300px;
}

.api-body-editor.is-empty {
  border: 0;
  border-radius: var(--app-radius-sm);
}

.api-body-editor :deep(.el-textarea),
.api-body-editor :deep(.el-textarea__inner),
.api-json-panel :deep(.el-textarea),
.api-json-panel :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 300px;
  border: 0;
  box-shadow: none;
  font-family: Consolas, Monaco, monospace;
}

.api-body-editor.is-empty,
.api-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.api-empty-body {
  width: 100%;
  min-height: 300px;
  border: 0;
  border-radius: var(--app-radius-sm);
  font-size: 13px;
}

.api-binary-panel,
.api-auth-panel,
.api-settings-panel,
.api-json-panel,
.api-cases-panel,
.api-assertion-panel,
.api-extractor-panel,
.api-processor-panel {
  display: grid;
  gap: 12px;
  max-width: none;
}

.api-processor-panel .api-processor-list > .api-empty-body {
  min-height: 100%;
  background: transparent;
  color: transparent;
}

.api-processor-panel .api-processor-list > .api-empty-body::after {
  content: "请选择一个处理器进行编辑";
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-assertion-panel .api-advanced-toolbar,
.api-assertion-panel > .api-empty-body {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.api-assertion-panel > .api-empty-body {
  min-height: 360px;
  background: #fff;
  color: transparent;
}

.api-assertion-panel > .api-empty-body::after {
  content: "请选择一个断言进行编辑";
  display: flex;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  align-items: center;
  justify-content: center;
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-auth-grid,
.api-settings-panel {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.api-settings-panel {
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-settings-panel > label {
  display: flex;
  min-height: 0;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-settings-panel > .el-input,
.api-settings-panel > .el-input-number,
.api-settings-panel > .el-textarea {
  min-height: 0;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-settings-panel > .el-input-number {
  width: 100%;
}

.api-settings-panel > .api-settings-control-cell {
  display: flex;
  min-height: 0;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-settings-panel :deep(.el-input-number) {
  width: 100%;
}

.api-settings-timeout-number {
  width: 100%;
  line-height: 32px;
}

.api-settings-timeout-number :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-settings-timeout-number :deep(.el-input__inner) {
  text-align: center;
}

.api-settings-timeout-number :deep(.el-input__wrapper:hover) {
  box-shadow: inset 0 0 0 1px var(--app-text-subtle);
}

.api-settings-timeout-number :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.api-settings-panel > label:nth-of-type(5) {
  align-items: flex-start;
  padding-top: 18px;
}

.api-settings-panel > .el-textarea {
  min-height: 104px;
}

.api-settings-footer {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 18px;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.api-auth-grid label,
.api-settings-panel label,
.api-form-label {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-auth-form-control {
  width: min(100%, 450px);
}

.api-auth-form-control :deep(.el-input__wrapper) {
  min-height: 34px;
  border-radius: var(--app-radius-md);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-auth-form-control :deep(.el-input__wrapper:hover) {
  box-shadow: inset 0 0 0 1px var(--app-text-subtle);
}

.api-auth-form-control :deep(.el-input__wrapper.is-focus) {
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.api-binary-panel {
  display: block;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: #fff;
}

.api-binary-row {
  display: grid;
  min-height: 0;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-binary-row:last-child {
  min-height: 0;
  border-bottom: 0;
}

.api-binary-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-binary-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.api-binary-pick,
.api-binary-clear {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  border: 1px solid var(--app-border-strong);
  border-radius: 4px;
  background: #fff;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-binary-pick input {
  display: none;
}

.api-binary-pick:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.api-binary-clear:disabled {
  border-color: var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.api-binary-selected {
  display: flex;
  min-height: 0;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-binary-file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-binary-file-size {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-cases-panel > .api-empty-body {
  min-height: 58px;
  margin-top: 14px;
  border: 1px dashed var(--app-border-strong);
  border-radius: var(--app-radius-lg);
  background: #fff;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-case-drawer-tabs {
  display: block;
  min-width: 0;
}

.api-case-detail-panel {
  display: grid;
  gap: 12px;
}

.api-run-result-pill.is-passed {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-run-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-run-result-pill.is-neutral {
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
}

.api-case-history-item:hover,
.api-case-history-item.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.case-drawer-history-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 420px;
}

.ms-like-top-tabs,
.ms-like-response-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  height: 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.ms-like-top-tabs::-webkit-scrollbar,
.ms-like-response-tabs::-webkit-scrollbar {
  display: none;
}

.ms-like-top-tab {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}

.ms-like-top-tab:hover {
  color: #111827;
}

.ms-like-top-tab.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 600;
}

.ms-like-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 999px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
}

.ms-like-response-shell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.ms-like-response-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0;
}

.ms-like-response-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.ms-like-response-metrics {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.ms-like-response-metric,
.ms-like-result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
}

.ms-like-result-pill.is-success,
.ms-like-result-pill.is-passed,
.ms-like-response-metric.is-success {
  background: #f0fdf4;
  color: #16a34a;
}

.ms-like-result-pill.is-failed,
.ms-like-response-metric.is-danger {
  background: #fef2f2;
  color: #dc2626;
}

.ms-like-response-metric.is-warning {
  background: #fff7ed;
  color: #ea580c;
}

.ms-like-response-body {
  min-width: 0;
  padding: 10px 0 12px;
}

.ms-like-response-empty {
  padding: 18px 0 20px;
}

.ms-like-response-empty-card {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 116px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.ms-like-response-empty-window {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 58px;
  height: 36px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.ms-like-response-empty-window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9ca3af;
}

.ms-like-response-empty-text {
  color: #6b7280;
  font-size: 13px;
}

.ms-like-response-empty-text span {
  color: #2563eb;
  font-weight: 600;
}

.api-case-readonly-body {
  padding: 0;
}

.api-case-readonly-body .api-param-table {
  margin: 0;
}

.api-case-readonly-body .api-param-table.is-readonly .api-param-row {
  cursor: default;
}

.api-case-readonly-body .api-param-table.is-readonly :deep(.el-input__wrapper),
.api-case-readonly-body .api-param-table.is-readonly :deep(.el-select__wrapper) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.api-case-readonly-body .api-body-chip:disabled {
  cursor: default;
  opacity: 1;
}

.api-case-readonly-body .api-body-chip.is-active:disabled {
  color: #2563eb;
  border-color: #93c5fd;
  background: #eff6ff;
}

.api-case-code-section {
  min-height: 260px;
}

.case-drawer-history-toolbar,
.case-drawer-history-detail-nav {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.case-drawer-history-limit-note,
.case-drawer-history-detail-time {
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-back {
  display: inline-flex;
  height: 30px;
  align-items: center;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.case-drawer-history-back:hover,
.case-drawer-history-back:focus-visible {
  background: #eff6ff;
  color: #1d4ed8;
}

.case-drawer-history-table-section {
  position: relative;
  z-index: 1;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  contain: layout paint;
}

.case-drawer-history-table {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.case-drawer-history-table :deep(.el-table__header th) {
  height: 38px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}

.case-drawer-history-table :deep(.el-table__row td) {
  height: 42px;
  font-size: 13px;
}

.case-drawer-history-result {
  display: inline-flex;
  min-width: 44px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.case-drawer-history-result.is-passed {
  background: #f0fdf4;
  color: #16a34a;
}

.case-drawer-history-result.is-failed {
  background: #fef2f2;
  color: #dc2626;
}

.case-drawer-history-result.is-neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.case-drawer-history-detail-shell,
.case-drawer-response-shell {
  min-height: 260px;
}

.case-drawer-history-detail-shell {
  position: relative;
  z-index: 0;
  margin-top: 2px;
  background: #fff;
}

.case-drawer-history-section,
.case-drawer-history-step {
  display: grid;
  gap: 10px;
}

.case-drawer-history-meta,
.case-drawer-history-request-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.case-drawer-history-request-summary {
  color: #374151;
  font-size: 13px;
}

.case-drawer-history-request-summary > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-drawer-history-section-title {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.case-drawer-history-table-empty {
  padding: 28px 0;
  color: #9ca3af;
  font-size: 13px;
}

.api-ai-result-filters button:hover,
.api-ai-result-filters button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-weight: 700;
}

.api-ai-result-status.is-failed,
.api-ai-status-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.ai-generation-run-result.is-success {
  color: #16a34a;
}

.ai-generation-run-result.is-failed {
  color: #dc2626;
}

.api-assertion-list-item.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-assertion-item-row.is-header {
  min-width: 720px;
  grid-template-columns: auto minmax(160px, 1fr) 170px minmax(160px, 1fr) auto auto;
}

.api-assertion-result-pill.is-passed {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-assertion-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-processor-list-item.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-response-result-pill.is-success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.api-response-result-pill.is-failed {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-response-pill.is-success {
  color: var(--app-success);
}

.api-response-pill.is-warning {
  color: var(--app-warning);
}
</style>
