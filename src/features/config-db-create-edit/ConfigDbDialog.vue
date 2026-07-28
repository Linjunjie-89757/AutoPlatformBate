<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Hide, View } from '@element-plus/icons-vue'

import { configDbTypeOptions, configStatusOptions, type DbConnectionItem } from '@/entities/config'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  applyDbTypeDefaults,
  buildCreateDbConnectionPayload,
  createConfigDbFormFromItem,
  createDefaultConfigDbForm,
  type ConfigDbDialogMode,
  type ConfigDbForm,
  validateConfigDbForm,
} from './model'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ConfigDbDialogMode
    dbConnection?: DbConnectionItem | null
    saving?: boolean
    defaultWorkspaceCode?: string
  }>(),
  {
    dbConnection: null,
    defaultWorkspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildCreateDbConnectionPayload>]
}>()

const form = reactive<ConfigDbForm>(createDefaultConfigDbForm(props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const passwordVisible = ref(false)

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.dbConnection
      ? createConfigDbFormFromItem(props.dbConnection)
      : createDefaultConfigDbForm(props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  formError.message = ''
  passwordVisible.value = false
}

function selectDbType(dbType: string) {
  applyDbTypeDefaults(form, dbType)
}

function submit() {
  const error = validateConfigDbForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildCreateDbConnectionPayload(form, {
    includePassword: props.mode === 'create' || Boolean(form.password),
  }))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)

watch(
  () => props.dbConnection,
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增数据库连接' : '编辑数据库连接'"
    width="672px"
    modal-class="config-db-dialog-modal"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="config-db-dialog">
      <div class="config-db-dialog__field">
        <span>目标空间</span>
        <el-input
          v-model="form.workspaceCode"
          placeholder="ALL"
          :disabled="mode === 'edit' || defaultWorkspaceCode !== 'ALL'"
        />
      </div>

      <div class="config-db-dialog__field">
        <span>连接名称 *</span>
        <el-input v-model="form.connectionName" placeholder="例如：主数据库（测试）" />
      </div>

      <div class="config-db-dialog__field">
        <span>数据库类型</span>
        <div class="config-db-dialog__segment">
          <button
            v-for="item in configDbTypeOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.dbType === item.value }"
            @click="selectDbType(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="config-db-dialog__grid is-two">
        <div class="config-db-dialog__field">
          <span>主机地址 *</span>
          <el-input v-model="form.host" placeholder="localhost 或 IP" />
        </div>
        <div class="config-db-dialog__field">
          <span>端口 *</span>
          <el-input v-model="form.port" placeholder="3306" />
        </div>
      </div>

      <div class="config-db-dialog__field">
        <span>数据库名 *</span>
        <el-input v-model="form.database" placeholder="数据库名称" />
      </div>

      <div class="config-db-dialog__grid is-two">
        <div class="config-db-dialog__field">
          <span>用户名</span>
          <el-input v-model="form.username" autocomplete="username" placeholder="用户名" />
        </div>
        <div class="config-db-dialog__field">
          <span>密码</span>
          <el-input
            v-model="form.password"
            :type="passwordVisible ? 'text' : 'password'"
            autocomplete="current-password"
            :placeholder="mode === 'edit' ? '留空沿用旧密码' : '密码'"
          >
            <template #suffix>
              <button
                type="button"
                class="config-db-dialog__password-toggle"
                :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
                @click="passwordVisible = !passwordVisible"
              >
                <el-icon>
                  <View v-if="!passwordVisible" />
                  <Hide v-else />
                </el-icon>
              </button>
            </template>
          </el-input>
        </div>
      </div>

      <div class="config-db-dialog__grid is-two">
        <div class="config-db-dialog__field">
          <span>连接池大小</span>
          <el-input-number v-model="form.poolMax" :min="1" :max="200" />
        </div>
        <div class="config-db-dialog__field">
          <span>超时时间（ms）</span>
          <el-input-number v-model="form.timeoutMs" :min="1000" :max="120000" :step="500" />
        </div>
      </div>

      <div class="config-db-dialog__field">
        <span>描述</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="描述该连接的用途或注意事项"
        />
      </div>

      <div class="config-db-dialog__field">
        <span>状态</span>
        <div class="config-db-dialog__segment is-two">
          <button
            v-for="item in configStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.status === item.value }"
            @click="form.status = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <p v-if="formError.message" class="config-db-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <div class="config-db-dialog__footer">
        <button type="button" class="config-db-dialog__secondary-button" :disabled="saving" @click="emit('update:modelValue', false)">取消</button>
        <button type="button" class="config-db-dialog__primary-button" :disabled="saving" @click="submit">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.config-db-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.config-db-dialog__grid {
  display: grid;
  gap: 12px;
}

.config-db-dialog__grid.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-db-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 5.25px;
}

.config-db-dialog__field > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.config-db-dialog__segment {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.config-db-dialog__segment.is-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-db-dialog__segment button {
  min-height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.config-db-dialog__segment button:hover {
  background: #fafafa;
}

.config-db-dialog__segment button.is-active {
  border-color: #165dff;
  background: #e8f3ff;
  color: #165dff;
}

.config-db-dialog__password-toggle {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
}

.config-db-dialog__password-toggle:hover {
  background: #f2f3f5;
  color: #1d2129;
}

.config-db-dialog__error {
  margin: 0;
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
}

.config-db-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.config-db-dialog__secondary-button,
.config-db-dialog__primary-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.config-db-dialog__secondary-button {
  border: 1px solid #e5e6eb;
  background: #fff;
  color: #4e5969;
}

.config-db-dialog__primary-button {
  border: 1px solid #165dff;
  background: #165dff;
  color: #fff;
}

.config-db-dialog__secondary-button:disabled,
.config-db-dialog__primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

:global(.config-db-dialog-modal .el-dialog) {
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16);
}

:global(.config-db-dialog-modal .el-dialog__header) {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #e5e6eb;
  margin: 0;
}

:global(.config-db-dialog-modal .el-dialog__title) {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

:global(.config-db-dialog-modal .el-dialog__body) {
  padding: 16px 20px;
}

:global(.config-db-dialog-modal .el-dialog__footer) {
  padding: 13px 20px;
  border-top: 1px solid #e5e6eb;
}

:global(.config-db-dialog-modal .el-input__wrapper),
:global(.config-db-dialog-modal .el-textarea__inner) {
  border-radius: 7px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

:global(.config-db-dialog-modal .el-input__wrapper) {
  min-height: 32px;
}

:global(.config-db-dialog-modal .el-input__inner),
:global(.config-db-dialog-modal .el-textarea__inner) {
  color: #1d2129;
  font-size: 13px;
}

:global(.config-db-dialog-modal .el-input-number) {
  width: 100%;
}

@media (max-width: 720px) {
  .config-db-dialog__grid.is-two,
  .config-db-dialog__segment {
    grid-template-columns: 1fr;
  }
}
</style>
