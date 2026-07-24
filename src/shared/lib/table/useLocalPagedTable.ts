import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export function useLocalPagedTable<T>(
  source: MaybeRefOrGetter<T[]>,
  options: { initialPageSize?: number } = {},
) {
  const pageNo = ref(1)
  const pageSize = ref(options.initialPageSize ?? 10)
  const total = computed(() => toValue(source).length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const items = computed(() => {
    const start = (pageNo.value - 1) * pageSize.value
    return toValue(source).slice(start, start + pageSize.value)
  })

  function setPage(value: number) {
    pageNo.value = Math.min(Math.max(1, value), totalPages.value)
  }

  function setPageSize(value: number) {
    pageSize.value = Math.max(1, value)
    pageNo.value = 1
  }

  function resetPage() {
    pageNo.value = 1
  }

  watch(totalPages, value => {
    if (pageNo.value > value) {
      pageNo.value = value
    }
  })

  return {
    items,
    total,
    totalPages,
    pageNo,
    pageSize,
    setPage,
    setPageSize,
    resetPage,
  }
}
