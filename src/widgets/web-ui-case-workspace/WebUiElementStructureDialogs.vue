<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import {
  WEB_UI_CASE_STATUS_OPTIONS,
  type SaveWebUiElementGroupPayload,
  type SaveWebUiElementModulePayload,
  type SaveWebUiElementPagePayload,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
} from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

defineProps<{
  moduleVisible: boolean
  pageVisible: boolean
  groupVisible: boolean
  moduleForm: SaveWebUiElementModulePayload
  pageForm: SaveWebUiElementPagePayload
  groupForm: SaveWebUiElementGroupPayload
  pageModuleOptions: WebUiElementModuleItem[]
  groupPageOptions: WebUiElementPageItem[]
  savingModule: boolean
  savingPage: boolean
  savingGroup: boolean
}>()

const emit = defineEmits<{
  'update:moduleVisible': [value: boolean]
  'update:pageVisible': [value: boolean]
  'update:groupVisible': [value: boolean]
  'save-module': []
  'save-page': []
  'save-group': []
}>()
</script>

<template>
  <el-dialog :model-value="moduleVisible" title="新增模块" width="560px" @update:model-value="emit('update:moduleVisible', $event)">
    <el-form label-width="96px">
      <el-form-item label="模块名称" required>
        <el-input v-model="moduleForm.moduleName" maxlength="80" placeholder="例如：订单模块" show-word-limit />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="moduleForm.sortOrder" :min="0" :max="9999" controls-position="right" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select :suffix-icon="AppSelectChevron" v-model="moduleForm.status">
          <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="moduleForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <AppButton @click="emit('update:moduleVisible', false)">取消</AppButton>
      <AppButton type="primary" :loading="savingModule" @click="emit('save-module')">保存</AppButton>
    </template>
  </el-dialog>

  <el-dialog :model-value="pageVisible" title="新增页面对象" width="560px" @update:model-value="emit('update:pageVisible', $event)">
    <el-form label-width="96px">
      <el-form-item label="所属模块" required>
        <el-select :suffix-icon="AppSelectChevron" v-model="pageForm.moduleId" filterable>
          <el-option v-for="item in pageModuleOptions" :key="item.id" :label="item.moduleName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="页面对象名称" required>
        <el-input v-model="pageForm.pageName" maxlength="80" placeholder="例如：登录页、订单列表页" show-word-limit />
      </el-form-item>
      <el-form-item label="路径规则">
        <el-input v-model="pageForm.pagePath" maxlength="500" clearable placeholder="/login 或 /orders/*" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="pageForm.sortOrder" :min="0" :max="9999" controls-position="right" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select :suffix-icon="AppSelectChevron" v-model="pageForm.status">
          <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="pageForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <AppButton @click="emit('update:pageVisible', false)">取消</AppButton>
      <AppButton type="primary" :loading="savingPage" @click="emit('save-page')">保存</AppButton>
    </template>
  </el-dialog>

  <el-dialog :model-value="groupVisible" title="新增分组" width="560px" @update:model-value="emit('update:groupVisible', $event)">
    <el-form label-width="96px">
      <el-form-item label="所属页面对象" required>
        <el-select :suffix-icon="AppSelectChevron" v-model="groupForm.pageId" filterable placeholder="选择页面对象">
          <el-option v-for="item in groupPageOptions" :key="item.id" :label="item.pageName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="分组名称" required>
        <el-input v-model="groupForm.groupName" maxlength="80" show-word-limit />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="groupForm.sortOrder" :min="0" :max="9999" controls-position="right" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select :suffix-icon="AppSelectChevron" v-model="groupForm.status">
          <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="groupForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <AppButton @click="emit('update:groupVisible', false)">取消</AppButton>
      <AppButton type="primary" :loading="savingGroup" @click="emit('save-group')">保存</AppButton>
    </template>
  </el-dialog>
</template>
