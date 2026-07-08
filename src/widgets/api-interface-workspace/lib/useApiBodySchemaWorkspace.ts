import { computed, ref, watch, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'

import type {
  ApiDefinitionDetail,
  ApiKeyValueInput,
  ApiRequestBodyInput,
  ApiRequestConfigInput,
  ApiSchemaFieldInput,
} from '@/entities/api-automation'
import type {
  ApiBodyLanguage,
  BodyJsonViewMode,
  DefinitionSchemaViewMode,
  RawBodyType,
} from '../apiInterfaceTypes'

const rawBodyTypes: RawBodyType[] = ['RAW_JSON', 'RAW_XML', 'RAW_TEXT']
const maxDebugFileBytes = 5 * 1024 * 1024

interface DefinitionSchemaGroup {
  key: 'path' | 'query' | 'header' | 'body'
  title: string
  description: string
  fields: ApiSchemaFieldInput[]
  emptyText: string
}

interface DefinitionResponseSchemaGroup {
  code: string
  fields: ApiSchemaFieldInput[]
}

interface UseApiBodySchemaWorkspaceOptions {
  activeEditor: ComputedRef<any>
  activeDetail: ComputedRef<ApiDefinitionDetail | null>
  confirmApiAction: (message: string, title: string, options?: { danger?: boolean; confirmText?: string }) => Promise<boolean>
  markDirty: () => void
  toPrettyJson: (value: unknown) => string
}

export function isRawBodyType(type?: string | null): type is RawBodyType {
  return rawBodyTypes.includes(type as RawBodyType)
}

export function bodyLanguage(type?: string | null): ApiBodyLanguage {
  if (type === 'RAW_JSON') return 'json'
  if (type === 'RAW_XML') return 'xml'
  return 'text'
}

export function getModeBodyText(body: ApiRequestBodyInput) {
  if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
  if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
  if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
  return body.rawText ?? ''
}

export function setModeBodyText(body: ApiRequestBodyInput, value: string, type = body.type) {
  if (type === 'RAW_JSON') {
    body.jsonText = value
  } else if (type === 'RAW_XML') {
    body.xmlText = value
  } else if (type === 'RAW_TEXT') {
    body.plainText = value
  }
  body.rawText = value
}

export function hydrateBodyModeText(body: ApiRequestBodyInput) {
  const rawText = body.rawText ?? ''
  body.jsonText = body.type === 'RAW_JSON' ? rawText : (body.jsonText ?? '')
  body.xmlText = body.type === 'RAW_XML' ? rawText : (body.xmlText ?? '')
  body.plainText = body.type === 'RAW_TEXT' ? rawText : (body.plainText ?? '')
}

export function syncRequestBodyRawText(requestConfig: ApiRequestConfigInput) {
  if (isRawBodyType(requestConfig.body.type)) {
    setModeBodyText(requestConfig.body, getModeBodyText(requestConfig.body), requestConfig.body.type)
  }
}

export function useApiBodySchemaWorkspace(options: UseApiBodySchemaWorkspaceOptions) {
  const bodyJsonViewMode = ref<BodyJsonViewMode>('json')
  const definitionBodyViewMode = ref<DefinitionSchemaViewMode>('schema')
  const definitionResponseViewMode = ref<DefinitionSchemaViewMode>('schema')
  const activeDefinitionResponseCode = ref('200')
  const activeBodyRawText = computed({
    get: () => options.activeDetail.value ? getModeBodyText(options.activeDetail.value.requestConfig.body) : '',
    set: (value: string) => {
      if (!options.activeDetail.value) return
      setModeBodyText(options.activeDetail.value.requestConfig.body, value)
      options.markDirty()
    },
  })
  const activeBodyLanguage = computed<ApiBodyLanguage>(() => bodyLanguage(options.activeDetail.value?.requestConfig.body.type))
  const activeSchemaFields = computed(() => options.activeDetail.value?.requestConfig.schemaFields || [])
  const bodySchemaFields = computed(() => schemaFieldsByLocation('body'))
  const querySchemaFields = computed(() => schemaFieldsByLocation('query'))
  const headerSchemaFields = computed(() => schemaFieldsByLocation('header'))
  const pathSchemaFields = computed(() => schemaFieldsByLocation('path'))
  const responseSchemaFields = computed(() => schemaFieldsByLocation('response'))
  const definitionRequestSchemaGroups = computed<DefinitionSchemaGroup[]>(() => {
    const groups: DefinitionSchemaGroup[] = [
      {
        key: 'path',
        title: 'Path 参数',
        description: '路径中的变量参数',
        fields: pathSchemaFields.value,
        emptyText: '暂无 Path 参数',
      },
      {
        key: 'query',
        title: 'Query 参数',
        description: 'URL 查询参数',
        fields: querySchemaFields.value,
        emptyText: '暂无 Query 参数',
      },
      {
        key: 'header',
        title: 'Header 参数',
        description: '请求头参数',
        fields: headerSchemaFields.value,
        emptyText: '暂无 Header 参数',
      },
    ]
    return groups.filter(group => group.fields.length)
  })
  const definitionRequestExampleJson = computed(() => {
    if (bodySchemaFields.value.length) return buildSchemaExampleText(bodySchemaFields.value)
    const text = options.activeDetail.value ? getModeBodyText(options.activeDetail.value.requestConfig.body).trim() : ''
    return text ? options.toPrettyJson(text) : '-'
  })
  const responseSchemaGroups = computed<DefinitionResponseSchemaGroup[]>(() => {
    const grouped = new Map<string, ApiSchemaFieldInput[]>()
    responseSchemaFields.value.forEach((field) => {
      const code = normalizeDefinitionResponseCode(field.responseCode)
      grouped.set(code, [...(grouped.get(code) || []), field])
    })
    return Array.from(grouped.entries())
      .map(([code, fields]) => ({ code, fields }))
      .sort((left, right) => compareDefinitionResponseCode(left.code, right.code))
  })
  const activeResponseSchemaGroup = computed(() => {
    if (!responseSchemaGroups.value.length) return null
    return responseSchemaGroups.value.find(group => group.code === activeDefinitionResponseCode.value) || responseSchemaGroups.value[0]
  })
  const activeResponseSchemaFields = computed(() => activeResponseSchemaGroup.value?.fields || [])
  const definitionResponseExampleJson = computed(() =>
    activeResponseSchemaFields.value.length ? buildSchemaExampleText(activeResponseSchemaFields.value) : '-',
  )

  watch(
    responseSchemaGroups,
    (groups) => {
      if (!groups.length) {
        activeDefinitionResponseCode.value = '200'
        return
      }
      if (!groups.some(group => group.code === activeDefinitionResponseCode.value)) {
        activeDefinitionResponseCode.value = groups[0].code
      }
    },
    { immediate: true },
  )

  function schemaFieldsByLocation(location: string) {
    return activeSchemaFields.value.filter(field => String(field.location || '').toLowerCase() === location)
  }

  function normalizeDefinitionResponseCode(code?: string | null) {
    const normalized = String(code || '').trim()
    return normalized || '200'
  }

  function compareDefinitionResponseCode(left: string, right: string) {
    const leftNumber = Number(left)
    const rightNumber = Number(right)
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber
    }
    if (Number.isFinite(leftNumber)) return -1
    if (Number.isFinite(rightNumber)) return 1
    return left.localeCompare(right)
  }

  function schemaFieldName(field: ApiSchemaFieldInput) {
    return field.fieldPath || field.name || '-'
  }

  function schemaFieldDepth(field: ApiSchemaFieldInput) {
    const path = field.fieldPath || field.name || ''
    return Math.max(0, path.replace(/\[\]/g, '').split('.').length - 1)
  }

  function schemaFieldType(field: ApiSchemaFieldInput) {
    const rawType = String(field.type || '').trim()
    const inferredType = rawType || inferSchemaFieldType(field)
    return [inferredType, field.format ? `(${field.format})` : ''].filter(Boolean).join(' ') || '-'
  }

  function inferSchemaFieldType(field: ApiSchemaFieldInput) {
    if (field.fieldPath?.includes('[]')) return 'array'
    const value = field.example ?? field.defaultValue
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
    if (Array.isArray(value)) return 'array'
    if (value && typeof value === 'object') return 'object'
    if (Array.isArray(field.enumValues) && field.enumValues.length) return 'string'
    return ''
  }

  function schemaFieldTypeClass(field: ApiSchemaFieldInput) {
    const type = schemaFieldType(field).toLowerCase()
    if (type.includes('array')) return 'is-array'
    if (type.includes('object')) return 'is-object'
    if (type.includes('integer') || type.includes('number')) return 'is-number'
    if (type.includes('boolean')) return 'is-boolean'
    return 'is-string'
  }

  function schemaFieldEnum(field: ApiSchemaFieldInput) {
    return Array.isArray(field.enumValues) && field.enumValues.length ? field.enumValues.join(' / ') : '-'
  }

  function schemaFieldLimit(field: ApiSchemaFieldInput) {
    const limits = [
      field.minLength != null || field.maxLength != null ? `长度 ${field.minLength ?? '-'} ~ ${field.maxLength ?? '-'}` : '',
      field.minimum != null || field.maximum != null ? `范围 ${field.minimum ?? '-'} ~ ${field.maximum ?? '-'}` : '',
    ].filter(Boolean)
    return limits.join('；') || '-'
  }

  function schemaFieldDisplayName(field: ApiSchemaFieldInput) {
    const path = field.fieldPath || field.name || ''
    if (!path) return '-'
    const normalized = path.replace(/\[\]/g, '[]')
    return normalized.split('.').filter(Boolean).pop() || normalized
  }

  function schemaFieldDescription(field: ApiSchemaFieldInput) {
    return field.description?.trim() || '-'
  }

  function schemaFieldExampleText(field: ApiSchemaFieldInput) {
    const value = field.example ?? field.defaultValue
    const text = schemaEditableValue(value)
    return text || '-'
  }

  function schemaFieldRuleText(field: ApiSchemaFieldInput) {
    const enumText = schemaFieldEnum(field)
    const limitText = schemaFieldLimit(field)
    return [enumText !== '-' ? `枚举：${enumText}` : '', limitText !== '-' ? limitText : ''].filter(Boolean).join('；') || '-'
  }

  function schemaEditableValue(value: unknown) {
    if (value == null) return ''
    return typeof value === 'string' ? value : JSON.stringify(value)
  }

  function updateSchemaFieldValue(field: ApiSchemaFieldInput, key: 'description' | 'example' | 'defaultValue', value: string) {
    if (key === 'description') {
      field.description = value
    } else {
      field[key] = value
    }
    options.markDirty()
  }

  function updateSchemaRequired(field: ApiSchemaFieldInput, value: unknown) {
    field.required = Boolean(value)
    options.markDirty()
  }

  function schemaFieldHasChildren(field: ApiSchemaFieldInput, fields: ApiSchemaFieldInput[]) {
    const path = field.fieldPath || field.name || ''
    if (!path) return false
    return fields.some(item => {
      const itemPath = item.fieldPath || item.name || ''
      return itemPath.startsWith(`${path}.`) || itemPath.startsWith(`${path}[].`)
    })
  }

  function schemaGeneratedValue(field: ApiSchemaFieldInput, fields: ApiSchemaFieldInput[]) {
    const type = schemaFieldType(field).toLowerCase()
    if (schemaFieldHasChildren(field, fields)) {
      return type.includes('array') || (field.fieldPath || '').endsWith('[]') ? [] : {}
    }
    const source = field.example ?? field.defaultValue ?? (Array.isArray(field.enumValues) && field.enumValues.length ? field.enumValues[0] : null)
    if (source != null && source !== '') {
      if (type.includes('integer') || type.includes('number')) {
        const numberValue = Number(source)
        return Number.isNaN(numberValue) ? 0 : numberValue
      }
      if (type.includes('boolean')) {
        return typeof source === 'boolean' ? source : String(source).toLowerCase() === 'true'
      }
      return source
    }
    if (type.includes('integer') || type.includes('number')) return 0
    if (type.includes('boolean')) return false
    if (type.includes('array')) return []
    if (type.includes('object')) return {}
    return ''
  }

  function setSchemaPathValue(root: Record<string, unknown>, fieldPath: string, value: unknown) {
    if (!fieldPath) return
    const parts = fieldPath.split('.').filter(Boolean)
    let cursor: Record<string, unknown> = root
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      const isArray = part.endsWith('[]')
      const key = isArray ? part.slice(0, -2) : part
      if (!key) return
      if (isLast) {
        if (isArray) {
          cursor[key] = Array.isArray(value) ? value : [value]
        } else {
          cursor[key] = value
        }
        return
      }
      if (isArray) {
        if (!Array.isArray(cursor[key])) cursor[key] = [{}]
        const list = cursor[key] as unknown[]
        if (!list[0] || typeof list[0] !== 'object' || Array.isArray(list[0])) list[0] = {}
        cursor = list[0] as Record<string, unknown>
        return
      }
      if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
      cursor = cursor[key] as Record<string, unknown>
    })
  }

  function buildSchemaExampleText(fields: ApiSchemaFieldInput[]) {
    if (!fields.length) return '-'
    const root: Record<string, unknown> = {}
    fields
      .slice()
      .sort((left, right) => schemaFieldDepth(left) - schemaFieldDepth(right))
      .forEach(field => setSchemaPathValue(root, field.fieldPath || field.name || '', schemaGeneratedValue(field, fields)))
    return options.toPrettyJson(root)
  }

  async function generateJsonFromBodySchema() {
    if (!options.activeDetail.value) return
    const fields = bodySchemaFields.value
    if (!fields.length) {
      ElMessage.info('当前请求体暂无 Schema 字段')
      return
    }
    const currentText = getModeBodyText(options.activeDetail.value.requestConfig.body).trim()
    if (currentText) {
      const confirmed = await options.confirmApiAction('当前请求体已有内容，是否用 Schema 示例 JSON 覆盖？', '生成示例 JSON')
      if (!confirmed) return
    }
    const root: Record<string, unknown> = {}
    fields
      .slice()
      .sort((left, right) => schemaFieldDepth(left) - schemaFieldDepth(right))
      .forEach(field => setSchemaPathValue(root, field.fieldPath || field.name || '', schemaGeneratedValue(field, fields)))
    setBodyMode('RAW_JSON')
    setModeBodyText(options.activeDetail.value.requestConfig.body, options.toPrettyJson(root), 'RAW_JSON')
    bodyJsonViewMode.value = 'json'
    options.markDirty()
    ElMessage.success('已根据 Schema 生成示例 JSON')
  }

  function schemaTypeFromJsonValue(value: unknown) {
    if (Array.isArray(value)) return 'array'
    if (value === null) return 'string'
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'object') return 'object'
    return 'string'
  }

  function schemaNameFromPath(path: string) {
    const last = path.split('.').filter(Boolean).pop() || path
    return last.replace(/\[\]$/, '')
  }

  function collectSchemaFieldsFromJson(value: unknown, parentPath = ''): ApiSchemaFieldInput[] {
    if (Array.isArray(value)) {
      const arrayPath = parentPath.endsWith('[]') ? parentPath : `${parentPath}[]`
      const first = value[0]
      if (first && typeof first === 'object') {
        return collectSchemaFieldsFromJson(first, arrayPath)
      }
      return [{
        location: 'body',
        fieldPath: arrayPath,
        name: schemaNameFromPath(arrayPath),
        type: first == null ? 'array' : schemaTypeFromJsonValue(first),
        format: null,
        required: false,
        description: '',
        example: first ?? '',
        defaultValue: null,
        enumValues: [],
        minLength: null,
        maxLength: null,
        minimum: null,
        maximum: null,
      }]
    }
    if (value && typeof value === 'object') {
      const fields: ApiSchemaFieldInput[] = []
      Object.entries(value as Record<string, unknown>).forEach(([key, childValue]) => {
        const fieldPath = parentPath ? `${parentPath}.${key}` : key
        const type = schemaTypeFromJsonValue(childValue)
        fields.push({
          location: 'body',
          fieldPath,
          name: key,
          type,
          format: null,
          required: false,
          description: '',
          example: type === 'object' || type === 'array' ? null : childValue,
          defaultValue: null,
          enumValues: [],
          minLength: null,
          maxLength: null,
          minimum: null,
          maximum: null,
        })
        if ((childValue && typeof childValue === 'object') || Array.isArray(childValue)) {
          fields.push(...collectSchemaFieldsFromJson(childValue, fieldPath))
        }
      })
      return fields
    }
    return []
  }

  function replaceBodySchemaFields(fields: ApiSchemaFieldInput[]) {
    if (!options.activeDetail.value) return
    const current = options.activeDetail.value.requestConfig.schemaFields || []
    options.activeDetail.value.requestConfig.schemaFields = [
      ...current.filter(field => String(field.location || '').toLowerCase() !== 'body'),
      ...fields,
    ]
    options.markDirty()
  }

  async function generateBodySchemaFromJson() {
    if (!options.activeDetail.value) return
    const currentText = getModeBodyText(options.activeDetail.value.requestConfig.body).trim()
    if (!currentText) {
      ElMessage.info('当前 JSON 请求体为空')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(currentText)
    } catch {
      ElMessage.warning('当前请求体不是合法 JSON，无法生成 Schema')
      return
    }
    const fields = collectSchemaFieldsFromJson(parsed)
    if (!fields.length) {
      ElMessage.info('当前 JSON 未解析出可用字段')
      return
    }
    if (bodySchemaFields.value.length) {
      const confirmed = await options.confirmApiAction('当前请求体已有 Schema，是否用当前 JSON 重新生成？', '生成 Schema')
      if (!confirmed) return
    }
    replaceBodySchemaFields(fields)
    bodyJsonViewMode.value = 'schema'
    ElMessage.success('已根据 JSON 生成请求体 Schema')
  }

  function setBodyMode(mode: ApiRequestBodyInput['type']) {
    if (!options.activeDetail.value) return
    options.activeDetail.value.requestConfig.body.type = mode
    if (mode === 'RAW_JSON') options.activeDetail.value.requestConfig.body.contentType = 'application/json'
    if (mode === 'RAW_XML') options.activeDetail.value.requestConfig.body.contentType = 'application/xml'
    if (mode === 'RAW_TEXT') options.activeDetail.value.requestConfig.body.contentType = 'text/plain'
    syncRequestBodyRawText(options.activeDetail.value.requestConfig)
    options.markDirty()
  }

  function readFileBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        resolve(result.includes(',') ? result.split(',')[1] : result)
      }
      reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }

  async function readDebugFile(file: File) {
    if (file.size > maxDebugFileBytes) {
      ElMessage.warning(`文件过大，请选择 ${formatFileSize(maxDebugFileBytes)} 以内的文件`)
      return null
    }
    return {
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
      base64: await readFileBase64(file),
    }
  }

  async function handleFormFileChange(row: ApiKeyValueInput, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const payload = await readDebugFile(file)
      if (!payload) return
      row.fileName = payload.fileName
      row.fileSize = payload.fileSize
      row.contentType = payload.contentType
      row.fileBase64 = payload.base64
      row.value = payload.fileName
      options.markDirty()
    } catch {
      ElMessage.error('文件读取失败')
    }
  }

  function clearFormFile(row: ApiKeyValueInput) {
    row.fileName = null
    row.fileSize = null
    row.contentType = null
    row.fileBase64 = null
    row.value = ''
    options.markDirty()
  }

  async function handleBinaryFileChange(event: Event) {
    if (!options.activeEditor.value) return
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const payload = await readDebugFile(file)
      if (!payload) return
      const body = options.activeEditor.value.detail.requestConfig.body
      body.fileName = payload.fileName
      body.fileSize = payload.fileSize
      body.contentType = payload.contentType
      body.binaryBase64 = payload.base64
      options.markDirty()
    } catch {
      ElMessage.error('文件读取失败')
    }
  }

  function clearBinaryFile() {
    if (!options.activeEditor.value) return
    const body = options.activeEditor.value.detail.requestConfig.body
    body.fileName = null
    body.fileSize = null
    body.contentType = null
    body.binaryBase64 = null
    options.markDirty()
  }

  function formatFileSize(size?: number | null) {
    if (!size) return '-'
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${size} B`
  }

  return {
    bodyJsonViewMode,
    definitionBodyViewMode,
    definitionResponseViewMode,
    activeDefinitionResponseCode,
    activeBodyRawText,
    activeBodyLanguage,
    activeSchemaFields,
    bodySchemaFields,
    responseSchemaFields,
    responseSchemaGroups,
    activeResponseSchemaGroup,
    activeResponseSchemaFields,
    definitionRequestSchemaGroups,
    definitionRequestExampleJson,
    definitionResponseExampleJson,
    schemaFieldDepth,
    schemaFieldName,
    schemaFieldDisplayName,
    schemaFieldTypeClass,
    schemaFieldType,
    schemaEditableValue,
    schemaFieldEnum,
    schemaFieldLimit,
    schemaFieldDescription,
    schemaFieldExampleText,
    schemaFieldRuleText,
    generateBodySchemaFromJson,
    generateJsonFromBodySchema,
    updateSchemaRequired,
    updateSchemaFieldValue,
    setBodyMode,
    handleFormFileChange,
    clearFormFile,
    handleBinaryFileChange,
    clearBinaryFile,
  }
}
