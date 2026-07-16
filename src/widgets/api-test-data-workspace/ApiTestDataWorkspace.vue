<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Delete, RefreshCw, Upload } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import { apiAutomationApi, type ApiDataFileDetail, type ApiDataFileItem } from '@/entities/api-automation'
import { confirmDelete } from '@/shared/ui'

const props = defineProps<{
  workspaceCode: string
  workspaceReady: boolean
}>()

const loading = ref(false)
const uploading = ref(false)
const files = ref<ApiDataFileItem[]>([])
const activeFileId = ref<number | null>(null)
const activeDetail = ref<ApiDataFileDetail | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const query = reactive({
  keyword: '',
})

const activeColumns = computed(() => activeDetail.value?.columns ?? [])
const activeRows = computed(() => activeDetail.value?.previewRows ?? [])

async function loadFiles() {
  if (!props.workspaceReady) {
    return
  }
  loading.value = true
  try {
    const page = await apiAutomationApi.getDataFiles(props.workspaceCode, {
      keyword: query.keyword.trim(),
      pageNo: 1,
      pageSize: 50,
    })
    files.value = page.items
    if (!activeFileId.value && files.value.length) {
      activeFileId.value = files.value[0].id
    }
    if (activeFileId.value && files.value.some(item => item.id === activeFileId.value)) {
      await loadDetail(activeFileId.value)
    } else {
      activeFileId.value = null
      activeDetail.value = null
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载数据文件失败')
  } finally {
    loading.value = false
  }
}

async function loadDetail(id: number) {
  activeFileId.value = id
  activeDetail.value = await apiAutomationApi.getDataFile(props.workspaceCode, id)
}

function chooseFile() {
  if (props.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间')
    return
  }
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  uploading.value = true
  try {
    const detail = await apiAutomationApi.uploadDataFile(props.workspaceCode, file, {
      fileName: file.name,
      caseDescColumn: 'caseDesc',
    })
    ElMessage.success('数据文件已上传')
    activeFileId.value = detail.id
    await loadFiles()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传数据文件失败')
  } finally {
    uploading.value = false
  }
}

async function deleteFile(row: ApiDataFileItem) {
  await confirmDelete({
    title: '删除数据文件',
    message: `确认删除数据文件「${row.fileName}」吗？删除后不可恢复。`,
    confirmText: '确认删除',
  })
  await apiAutomationApi.deleteDataFile(props.workspaceCode, row.id)
  ElMessage.success('数据文件已删除')
  if (activeFileId.value === row.id) {
    activeFileId.value = null
    activeDetail.value = null
  }
  await loadFiles()
}

watch(() => props.workspaceCode, () => {
  activeFileId.value = null
  activeDetail.value = null
  void loadFiles()
})

onMounted(() => {
  void loadFiles()
})
</script>

<template>
  <section class="api-test-data-workspace">
    <header class="api-test-data-toolbar">
      <div class="api-test-data-title">
        <strong>数据文件库</strong>
        <span>套件级 CSV 数据驱动，列名可在接口、场景、套件执行中作为变量使用。</span>
      </div>
      <div class="api-test-data-actions">
        <el-input
          v-model="query.keyword"
          class="api-test-data-search"
          clearable
          placeholder="搜索文件"
          @keyup.enter="loadFiles"
          @clear="loadFiles"
        />
        <el-button :icon="RefreshCw" @click="loadFiles">刷新</el-button>
        <el-button type="primary" :icon="Upload" :loading="uploading" @click="chooseFile">上传 CSV</el-button>
        <input ref="fileInputRef" class="api-test-data-file-input" type="file" accept=".csv,.txt" @change="handleFileChange">
      </div>
    </header>

    <main class="api-test-data-main" v-loading="loading">
      <section class="api-test-data-list">
        <div
          v-for="item in files"
          :key="item.id"
          class="api-test-data-file-card"
          :class="{ active: item.id === activeFileId }"
          @click="loadDetail(item.id)"
        >
          <div class="api-test-data-file-head">
            <strong>{{ item.fileName }}</strong>
            <el-button text :icon="Delete" @click.stop="deleteFile(item)" />
          </div>
          <div class="api-test-data-file-meta">
            <span>{{ item.rowCount }} 行</span>
            <span>{{ item.columns.length }} 列</span>
            <span>{{ item.encoding }}</span>
          </div>
          <p>{{ item.columns.join(' / ') || '暂无列信息' }}</p>
        </div>
        <el-empty v-if="!files.length && !loading" description="暂无数据文件" />
      </section>

      <section class="api-test-data-preview">
        <template v-if="activeDetail">
          <div class="api-test-data-preview-head">
            <div>
              <strong>{{ activeDetail.fileName }}</strong>
              <span>预览前 {{ activeRows.length }} 行 / 共 {{ activeDetail.rowCount }} 行</span>
            </div>
            <el-tag size="small">{{ activeDetail.fileType }}</el-tag>
          </div>
          <el-table :data="activeRows" height="100%" border>
            <el-table-column prop="rowIndex" label="行号" width="72" fixed />
            <el-table-column prop="caseDesc" label="caseDesc" min-width="160" />
            <el-table-column
              v-for="column in activeColumns"
              :key="column"
              :label="column"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ row.values[column] ?? '' }}
              </template>
            </el-table-column>
          </el-table>
        </template>
        <el-empty v-else description="选择左侧数据文件查看预览" />
      </section>
    </main>
  </section>
</template>

<style scoped>
.api-test-data-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #f8fafc;
}

.api-test-data-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.api-test-data-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #111827;
}

.api-test-data-title span {
  color: #6b7280;
  font-size: 12px;
}

.api-test-data-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-test-data-search {
  width: 220px;
}

.api-test-data-file-input {
  display: none;
}

.api-test-data-main {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
}

.api-test-data-list,
.api-test-data-preview {
  min-height: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.api-test-data-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding: 10px;
}

.api-test-data-file-card {
  cursor: pointer;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.api-test-data-file-card:hover,
.api-test-data-file-card.active {
  border-color: #93c5fd;
  background: #eff6ff;
}

.api-test-data-file-head,
.api-test-data-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.api-test-data-file-head strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-test-data-file-meta {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  color: #6b7280;
  font-size: 12px;
}

.api-test-data-file-card p {
  margin: 8px 0 0;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-test-data-preview {
  display: flex;
  flex-direction: column;
}

.api-test-data-preview-head {
  flex: 0 0 auto;
  padding: 12px 14px;
  border-bottom: 1px solid #e5e7eb;
}

.api-test-data-preview-head div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.api-test-data-preview-head span {
  color: #6b7280;
  font-size: 12px;
}
</style>
