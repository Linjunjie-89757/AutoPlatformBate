import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  configApi,
  type CreateDbConnectionPayload,
  type DbConnectionItem,
} from '@/entities/config'
import type { ConfigDbDialogMode } from '@/features/config-db-create-edit'
import { deleteConfigDbConnection } from '@/features/config-db-delete'
import { testConfigDbConnection } from '@/features/config-db-test-connection'
import { getRequestErrorMessage } from '@/shared/api/error'
import { debounce } from '@/shared/lib/debounce'
import { confirmDelete } from '@/shared/ui'

export function useConfigDbManagement(workspaceCode: Readonly<Ref<string>>) {
  const dbConnections = ref<DbConnectionItem[]>([])
  const dbConnectionTotal = ref(0)
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  const dialogVisible = ref(false)
  const dialogMode = ref<ConfigDbDialogMode>('create')
  const editingDbConnection = ref<DbConnectionItem | null>(null)
  const testingDbConnectionId = ref<number | null>(null)
  const dbConnectionTestResults = ref<Record<number, 'success' | 'failure'>>({})
  const deletingDbConnectionId = ref<number | null>(null)
  const filterKeyword = ref('')
  let loadRequestId = 0

  const filteredDbConnections = computed(() => dbConnections.value)
  const dbConnectionQuery = computed(() => ({
    keyword: filterKeyword.value.trim(),
  }))
  const emptyDescription = computed(() => (
    filterKeyword.value.trim()
      ? '当前筛选条件下没有数据库连接配置。'
      : '当前空间还没有数据库连接配置。'
  ))

  const debouncedLoadDbConnections = debounce(() => {
    void loadDbConnections()
  }, 300)

  async function loadDbConnections() {
    const requestId = ++loadRequestId
    loading.value = true
    errorMessage.value = ''
    try {
      const page = await configApi.getSettingsDbConnections(workspaceCode.value, dbConnectionQuery.value)
      if (requestId !== loadRequestId) return
      dbConnections.value = Array.isArray(page.items) ? page.items : []
      dbConnectionTotal.value = Number.isFinite(page.total) ? page.total : dbConnections.value.length
    } catch (error) {
      if (requestId !== loadRequestId) return
      errorMessage.value = getRequestErrorMessage(error)
    } finally {
      if (requestId === loadRequestId) {
        loading.value = false
      }
    }
  }

  function openCreateDialog() {
    dialogMode.value = 'create'
    editingDbConnection.value = null
    dialogVisible.value = true
  }

  function openEditDialog(dbConnection: DbConnectionItem) {
    dialogMode.value = 'edit'
    editingDbConnection.value = dbConnection
    dialogVisible.value = true
  }

  async function submitDbConnection(payload: CreateDbConnectionPayload) {
    saving.value = true
    try {
      if (dialogMode.value === 'edit' && editingDbConnection.value) {
        await configApi.updateSettingsDbConnection(workspaceCode.value, editingDbConnection.value.id, payload)
        ElMessage.success('数据库连接已更新')
      } else {
        await configApi.createSettingsDbConnection(workspaceCode.value, payload)
        ElMessage.success('数据库连接已创建')
      }
      dialogVisible.value = false
      await loadDbConnections()
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      saving.value = false
    }
  }

  async function testConnection(dbConnection: DbConnectionItem) {
    testingDbConnectionId.value = dbConnection.id
    try {
      const result = await testConfigDbConnection(dbConnection, workspaceCode.value)
      if (result?.success === false) {
        dbConnectionTestResults.value[dbConnection.id] = 'failure'
        ElMessage.error(result.message || '数据库连接测试失败')
        return
      }

      dbConnectionTestResults.value[dbConnection.id] = 'success'
      const suffix = result?.elapsedMs ? `，耗时 ${result.elapsedMs}ms` : ''
      ElMessage.success(result?.message || `数据库连接测试成功${suffix}`)
    } catch (error) {
      dbConnectionTestResults.value[dbConnection.id] = 'failure'
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      testingDbConnectionId.value = null
    }
  }

  async function openDeleteDialog(dbConnection: DbConnectionItem) {
    try {
      await confirmDelete({
        title: '删除数据库连接',
        message: `确认删除“${dbConnection.connectionName}”吗？删除后不可恢复。`,
        confirmText: '确认删除',
        loadingText: '删除中...',
        beforeConfirm: async () => {
          deletingDbConnectionId.value = dbConnection.id
          try {
            await deleteConfigDbConnection(dbConnection, workspaceCode.value)
            ElMessage.success('数据库连接已删除')
            await loadDbConnections()
          } catch (error) {
            ElMessage.error(getRequestErrorMessage(error))
            throw error
          } finally {
            deletingDbConnectionId.value = null
          }
        },
      })
    } catch {
      // Closing the confirmation dialog does not require user feedback.
    }
  }

  onMounted(() => {
    void loadDbConnections()
  })

  onBeforeUnmount(() => {
    loadRequestId += 1
    debouncedLoadDbConnections.cancel()
  })

  watch(workspaceCode, () => {
    debouncedLoadDbConnections.cancel()
    dbConnectionTestResults.value = {}
    void loadDbConnections()
  })

  watch(filterKeyword, () => {
    debouncedLoadDbConnections()
  }, { flush: 'sync' })

  return {
    dbConnections,
    dbConnectionTotal,
    loading,
    saving,
    errorMessage,
    dialogVisible,
    dialogMode,
    editingDbConnection,
    testingDbConnectionId,
    dbConnectionTestResults,
    deletingDbConnectionId,
    filterKeyword,
    filteredDbConnections,
    emptyDescription,
    loadDbConnections,
    openCreateDialog,
    openEditDialog,
    submitDbConnection,
    testConnection,
    openDeleteDialog,
  }
}
