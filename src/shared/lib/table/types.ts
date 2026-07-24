export interface PagedResult<T> {
  items: T[]
  total: number
  pageNo?: number
  pageSize?: number
  totalPages?: number
}

export interface AppTableColumnDefinition {
  key: string
  label: string
  defaultVisible: boolean
  required?: boolean
  draggable?: boolean
  width?: number
  minWidth?: number
}

export interface AppTableColumnSettingsItem extends Omit<AppTableColumnDefinition, 'required' | 'draggable'> {
  required: boolean
  draggable: boolean
  visible: boolean
}
