import type { ApiSchemaFieldInput } from '@/entities/api-automation'

export interface DefinitionSchemaGroup {
  key: 'path' | 'query' | 'header' | 'body'
  title: string
  description: string
  fields: ApiSchemaFieldInput[]
  emptyText: string
}

export interface DefinitionResponseSchemaGroup {
  code: string
  fields: ApiSchemaFieldInput[]
}
