import { configApi, type DbConnectionItem } from '@/entities/config'

export async function deleteConfigDbConnection(dbConnection: DbConnectionItem, workspaceCode = 'ALL') {
  await configApi.deleteSettingsDbConnection(workspaceCode, dbConnection.id)
}
