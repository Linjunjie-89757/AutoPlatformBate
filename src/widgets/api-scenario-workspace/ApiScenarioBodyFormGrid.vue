<script setup lang="ts">
import type { ApiScenarioBodyFormGridProps } from './lib/apiScenarioStepConfigTypes'

defineProps<ApiScenarioBodyFormGridProps>()

const selectionModel = defineModel<boolean>('selection', { required: true })
</script>

<template>
  <div class="body-form-grid ms-like-table-surface ms-like-param-table ms-like-param-table--body-form">
    <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--body-form">
      <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
        <el-checkbox
          v-model="selectionModel"
          :indeterminate="selectionState.indeterminate"
        />
      </div>
      <span class="ms-like-header-input-title">参数名称</span>
      <span class="ms-like-type-header">类型</span>
      <span>参数值</span>
      <span class="ms-like-length-header">长度范围</span>
      <span>描述</span>
      <span></span>
    </div>
    <div v-for="(row, index) in rows" :key="`scenario-body-${index}`" class="ms-like-table-row ms-like-param-table-grid ms-like-param-table-grid--body-form">
      <div class="ms-like-checkbox-cell"><el-checkbox v-model="row.enabled" @change="markScenarioDirty" /></div>
      <div class="ms-like-name-field">
        <el-input v-model="row.key" placeholder="参数名称" @input="handleScenarioKeyValueRowInput(rows, defaults)" />
      </div>
      <div class="ms-like-type-field">
        <button type="button" :class="['ms-like-required-button', { active: row.required }]" :title="row.required ? '必填' : '非必填'" @click="row.required = !row.required; markScenarioDirty()">*</button>
        <el-select v-model="row.paramType" @change="handleScenarioKeyValueRowInput(rows, defaults)">
          <el-option v-for="option in paramTypeOptions" :key="option" :label="option" :value="option" />
        </el-select>
      </div>
      <div v-if="row.paramType === 'file'" class="ms-like-file-param-cell">
        <button type="button" class="ms-like-file-pick" @click="pickScenarioBodyFormRowFile(row, rows)">{{ row.fileName || '选择文件' }}</button>
        <button v-if="row.fileBase64" type="button" class="ms-like-file-clear" @click="clearScenarioBodyFormRowFile(row)">清空</button>
        <small v-if="row.fileBase64">{{ formatScenarioBodyFormFileSize(row) }}</small>
      </div>
      <el-input v-else v-model="row.value" placeholder="参数值" @input="handleScenarioKeyValueRowInput(rows, defaults)" />
      <div class="ms-like-length-range-cell">
        <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="handleScenarioKeyValueRowInput(rows, defaults)" />
        <span>至</span>
        <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="handleScenarioKeyValueRowInput(rows, defaults)" />
      </div>
      <el-input v-model="row.description" placeholder="描述" @input="handleScenarioKeyValueRowInput(rows, defaults)" />
      <button type="button" class="ms-like-row-remove" @click="removeScenarioKeyValueRow(rows, index)">删除</button>
    </div>
    <button type="button" class="ms-like-add-row" @click="addScenarioKeyValueRow(rows, defaults)">+ 添加一行</button>
  </div>
</template>
