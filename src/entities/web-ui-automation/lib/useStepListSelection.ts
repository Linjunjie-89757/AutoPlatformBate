import type { Ref } from 'vue'

interface SortableStep {
  sortOrder: number
}

interface StepListSelectionOptions<TStep extends SortableStep> {
  getSteps: () => TStep[]
  selectedIndex: Ref<number>
  selectedIndexes: Ref<number[]>
  draggingIndex: Ref<number | null>
}

export function useStepListSelection<TStep extends SortableStep>(options: StepListSelectionOptions<TStep>) {
  function isValidIndex(index: number) {
    return Number.isInteger(index) && index >= 0 && index < options.getSteps().length
  }

  function clear() {
    options.selectedIndexes.value = []
  }

  function normalize() {
    options.selectedIndexes.value = options.selectedIndexes.value
      .filter(isValidIndex)
      .sort((left, right) => left - right)
  }

  function selectedItems() {
    return options.selectedIndexes.value
      .map(index => options.getSteps()[index])
      .filter((step): step is TStep => Boolean(step))
  }

  function restore(items: TStep[]) {
    const steps = options.getSteps()
    options.selectedIndexes.value = items
      .map(step => steps.indexOf(step))
      .filter(index => index >= 0)
      .sort((left, right) => left - right)
  }

  function reorder() {
    options.getSteps().forEach((step, index) => {
      step.sortOrder = index + 1
    })
  }

  function move(index: number, direction: -1 | 1) {
    const steps = options.getSteps()
    const targetIndex = index + direction
    if (!isValidIndex(index) || !isValidIndex(targetIndex)) {
      return false
    }

    const selected = selectedItems()
    const [step] = steps.splice(index, 1)
    steps.splice(targetIndex, 0, step)
    options.selectedIndex.value = targetIndex
    restore(selected)
    reorder()
    return true
  }

  function startDrag(index: number) {
    options.draggingIndex.value = index
  }

  function finishDrag() {
    options.draggingIndex.value = null
  }

  function drop(targetIndex: number) {
    const steps = options.getSteps()
    const sourceIndex = options.draggingIndex.value
    if (
      sourceIndex === null
      || sourceIndex === targetIndex
      || !isValidIndex(sourceIndex)
      || !isValidIndex(targetIndex)
    ) {
      finishDrag()
      return false
    }

    const selected = selectedItems()
    const selectedStep = steps[options.selectedIndex.value]
    const [step] = steps.splice(sourceIndex, 1)
    steps.splice(targetIndex, 0, step)
    if (selectedStep) {
      options.selectedIndex.value = Math.max(0, steps.indexOf(selectedStep))
    }
    restore(selected)
    reorder()
    finishDrag()
    return true
  }

  return {
    clear,
    drop,
    finishDrag,
    isValidIndex,
    move,
    normalize,
    reorder,
    restore,
    selectedItems,
    startDrag,
  }
}
