<script setup lang="ts">
import {
  formatLocatorType,
  type ValidateWebUiLocatorResponse,
  type WebUiElementGroupItem,
  type WebUiElementItem,
  type WebUiElementPageItem,
  type WebUiEnvironmentItem,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

defineProps<{
  batchMoveVisible: boolean
  importVisible: boolean
  validateVisible: boolean
  batchMoveForm: {
    pageId: number | null
    groupId: number | null
  }
  batchMoveGroupOptions: WebUiElementGroupItem[]
  pages: WebUiElementPageItem[]
  batchOperating: boolean
  importJsonText: string
  importingElements: boolean
  validateTarget: WebUiElementItem | null
  validateEnvironmentId: number | null
  validateBaseUrl: string
  enabledEnvironments: WebUiEnvironmentItem[]
  validateResult: ValidateWebUiLocatorResponse | null
  validateFailureHint: string
  validateImageSrc: string
  validating: boolean
  localRunnerValidating: boolean
}>()

const emit = defineEmits<{
  'update:batchMoveVisible': [value: boolean]
  'update:importVisible': [value: boolean]
  'update:validateVisible': [value: boolean]
  'update:importJsonText': [value: string]
  'update:validateEnvironmentId': [value: number | null]
  'update:validateBaseUrl': [value: string]
  'batch-page-change': [value: number | null]
  'validate-environment-change': [value: number | null]
  'submit-batch-move': []
  'submit-import': []
  'preview-validate-screenshot': []
  'submit-validate': []
  'submit-local-runner-validate': []
}>()
</script>

<template>
  <el-dialog :model-value="batchMoveVisible" title="批量移动分组" width="560px" @update:model-value="emit('update:batchMoveVisible', $event)">
    <el-form label-width="96px">
      <el-form-item label="目标页面对象" required>
        <el-select v-model="batchMoveForm.pageId" filterable placeholder="选择页面对象" @change="emit('batch-page-change', $event as number | null)">
          <el-option v-for="item in pages" :key="item.id" :label="item.pageName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="目标分组">
        <el-select v-model="batchMoveForm.groupId" clearable filterable placeholder="可不选择分组">
          <el-option v-for="item in batchMoveGroupOptions" :key="item.id" :label="item.groupName" :value="item.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <AppButton @click="emit('update:batchMoveVisible', false)">取消</AppButton>
      <AppButton type="primary" :loading="batchOperating" @click="emit('submit-batch-move')">确认移动</AppButton>
    </template>
  </el-dialog>

  <el-dialog
    :model-value="importVisible"
    title="批量导入元素"
    width="760px"
    class="web-ui-element-import-dialog"
    @update:model-value="emit('update:importVisible', $event)"
  >
    <div class="web-ui-element-import">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        title="请粘贴 JSON 数组。支持 moduleName、pageName、pagePath、groupName、elementName、locatorType、locatorValue、description、status。"
      />
      <el-input
        :model-value="importJsonText"
        type="textarea"
        :rows="16"
        resize="vertical"
        spellcheck="false"
        placeholder='[{"moduleName":"订单模块","pageName":"订单列表页","groupName":"查询区","elementName":"订单号输入框","locatorType":"CSS","locatorValue":"input[name=\"orderNo\"]"}]'
        @update:model-value="emit('update:importJsonText', String($event))"
      />
    </div>
    <template #footer>
      <AppButton @click="emit('update:importVisible', false)">取消</AppButton>
      <AppButton type="primary" :loading="importingElements" @click="emit('submit-import')">开始导入</AppButton>
    </template>
  </el-dialog>

  <el-dialog :model-value="validateVisible" title="验证元素定位器" width="720px" @update:model-value="emit('update:validateVisible', $event)">
    <div class="web-ui-element-validate">
      <el-alert
        v-if="validateTarget"
        type="info"
        show-icon
        :closable="false"
        :title="`${validateTarget.elementName}：${formatLocatorType(validateTarget.locatorType)} = ${validateTarget.locatorValue}`"
      />
      <el-form label-width="96px">
        <el-form-item label="运行环境">
          <el-select
            :model-value="validateEnvironmentId"
            clearable
            placeholder="选择环境"
            @update:model-value="emit('update:validateEnvironmentId', ($event || null) as number | null)"
            @change="emit('validate-environment-change', $event as number | null)"
          >
            <el-option v-for="item in enabledEnvironments" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="验证地址" required>
          <el-input :model-value="validateBaseUrl" placeholder="https://example.com/login" @update:model-value="emit('update:validateBaseUrl', String($event))" />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="validateResult"
        :type="validateResult.matched ? 'success' : 'warning'"
        :title="validateResult.matched ? `匹配到 ${validateResult.matchCount} 个元素` : validateResult.matchCount > 0 ? `匹配到 ${validateResult.matchCount} 个元素，未通过验证` : '未匹配到元素'"
        :description="validateResult.errorMessage || ''"
        show-icon
        :closable="false"
      />
      <el-alert
        v-if="validateFailureHint"
        type="info"
        show-icon
        :closable="false"
        :title="validateFailureHint"
      />
      <div v-if="validateImageSrc" class="web-ui-element-validate__screenshot">
        <img class="web-ui-element-validate__image" :src="validateImageSrc" alt="元素验证截图">
        <AppButton size="small" @click="emit('preview-validate-screenshot')">查看大图</AppButton>
      </div>
    </div>
    <template #footer>
      <AppButton @click="emit('update:validateVisible', false)">关闭</AppButton>
      <AppButton :loading="localRunnerValidating" :disabled="validating" @click="emit('submit-local-runner-validate')">本地验证当前页</AppButton>
      <AppButton type="primary" :loading="validating" :disabled="localRunnerValidating" @click="emit('submit-validate')">开始验证</AppButton>
    </template>
  </el-dialog>
</template>

<style scoped>
.web-ui-element-import {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-element-validate {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-element-validate :deep(.el-select) {
  width: 100%;
}

.web-ui-element-validate__screenshot {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-element-validate__screenshot :deep(.app-button) {
  justify-self: flex-start;
}

.web-ui-element-validate__image {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
}
</style>
