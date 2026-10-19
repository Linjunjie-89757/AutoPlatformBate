<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import {
  WEB_UI_CASE_STATUS_OPTIONS,
  WEB_UI_LOCATOR_OPTIONS,
  type SaveWebUiElementPayload,
  type WebUiElementGroupItem,
  type WebUiElementPageItem,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

defineProps<{
  modelValue: boolean
  editing: boolean
  form: SaveWebUiElementPayload
  elementPageOptions: WebUiElementPageItem[]
  availableGroups: WebUiElementGroupItem[]
  saving: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'page-change': []
  'group-change': []
  save: []
}>()
</script>

<template>
  <el-dialog :model-value="modelValue" :title="editing ? '编辑元素' : '新增元素'" width="620px" @update:model-value="emit('update:modelValue', $event)">
    <el-form label-width="96px">
      <el-form-item label="页面对象" required>
        <el-select :suffix-icon="AppSelectChevron" v-model="form.pageId" clearable filterable placeholder="选择页面对象" @change="emit('page-change')">
          <el-option v-for="item in elementPageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="页面分组">
        <el-select :suffix-icon="AppSelectChevron" v-model="form.groupId" clearable filterable placeholder="选择分组" @change="emit('group-change')">
          <el-option v-for="item in availableGroups" :key="item.id" :label="item.groupName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="元素名称" required>
        <el-input v-model="form.elementName" maxlength="80" placeholder="例如：用户名输入框" show-word-limit />
      </el-form-item>
      <el-form-item label="定位方式" required>
        <el-select :suffix-icon="AppSelectChevron" v-model="form.locatorType">
          <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="定位值" required>
        <el-input v-model="form.locatorValue" maxlength="1000" clearable placeholder="#username 或 //input[@name='username']" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select :suffix-icon="AppSelectChevron" v-model="form.status">
          <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <AppButton @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="emit('save')">保存</AppButton>
    </template>
  </el-dialog>
</template>
