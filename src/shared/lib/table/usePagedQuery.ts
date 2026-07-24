import {
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import type { PagedResult } from './types'

interface UsePagedQueryOptions<T, Q extends Record<string, unknown>> {
  query: MaybeRefOrGetter<Q>
  fetcher: (query: Q & { pageNo: number; pageSize: number }) => Promise<PagedResult<T>>
  enabled?: MaybeRefOrGetter<boolean>
  initialPageSize?: number
}

export function usePagedQuery<T, Q extends Record<string, unknown>>(
  options: UsePagedQueryOptions<T, Q>,
) {
  const items = shallowRef<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const pageNo = ref(1)
  const pageSize = ref(options.initialPageSize ?? 10)
  const loading = ref(false)
  const error = shallowRef<unknown>(null)
  let requestSequence = 0

  async function refresh() {
    if (options.enabled !== undefined && !toValue(options.enabled)) {
      return
    }

    const requestId = ++requestSequence
    loading.value = true
    error.value = null
    try {
      const result = await options.fetcher({
        ...toValue(options.query),
        pageNo: pageNo.value,
        pageSize: pageSize.value,
      })
      if (requestId !== requestSequence) return

      items.value = Array.isArray(result.items) ? result.items : []
      total.value = Number(result.total) || 0
      const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
      if (pageNo.value > maxPage) {
        pageNo.value = maxPage
      }
    } catch (reason) {
      if (requestId !== requestSequence) return
      error.value = reason
    } finally {
      if (requestId === requestSequence) {
        loading.value = false
      }
    }
  }

  function setPage(value: number) {
    pageNo.value = Math.max(1, value)
  }

  function setPageSize(value: number) {
    pageSize.value = Math.max(1, value)
    pageNo.value = 1
  }

  function resetPage() {
    pageNo.value = 1
  }

  watch(
    () => [toValue(options.query), options.enabled === undefined ? true : toValue(options.enabled), pageNo.value, pageSize.value],
    () => {
      void refresh()
    },
    { deep: true, immediate: true },
  )

  return {
    items,
    total,
    pageNo,
    pageSize,
    loading,
    error,
    refresh,
    setPage,
    setPageSize,
    resetPage,
  }
}
