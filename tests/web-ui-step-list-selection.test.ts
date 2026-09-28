import test from 'node:test'
import assert from 'node:assert/strict'

import { useStepListSelection } from '../src/entities/web-ui-automation/lib/useStepListSelection.ts'

interface Step {
  name: string
  sortOrder: number
}

function createEditor(stepNames: string[]) {
  const steps = stepNames.map((name, index) => ({ name, sortOrder: index + 1 }))
  const selectedIndex = { value: 0 }
  const selectedIndexes = { value: [] as number[] }
  const draggingIndex = { value: null as number | null }
  const editor = useStepListSelection<Step>({
    getSteps: () => steps,
    selectedIndex,
    selectedIndexes,
    draggingIndex,
  })
  return { steps, selectedIndex, selectedIndexes, draggingIndex, editor }
}

test('move keeps multi-selection attached to the same steps and selects the moved step', () => {
  const { steps, selectedIndex, selectedIndexes, editor } = createEditor(['A', 'B', 'C', 'D'])
  selectedIndex.value = 0
  selectedIndexes.value = [1, 3]

  assert.equal(editor.move(1, 1), true)

  assert.deepEqual(steps.map(step => step.name), ['A', 'C', 'B', 'D'])
  assert.equal(selectedIndex.value, 2)
  assert.deepEqual(selectedIndexes.value, [2, 3])
  assert.deepEqual(steps.map(step => step.sortOrder), [1, 2, 3, 4])
})

test('drop preserves the active step and multi-selection by object identity', () => {
  const { steps, selectedIndex, selectedIndexes, draggingIndex, editor } = createEditor(['A', 'B', 'C', 'D'])
  selectedIndex.value = 1
  selectedIndexes.value = [0, 2]
  editor.startDrag(0)

  assert.equal(editor.drop(3), true)

  assert.deepEqual(steps.map(step => step.name), ['B', 'C', 'D', 'A'])
  assert.equal(selectedIndex.value, 0)
  assert.deepEqual(selectedIndexes.value, [1, 3])
  assert.equal(draggingIndex.value, null)
  assert.deepEqual(steps.map(step => step.sortOrder), [1, 2, 3, 4])
})

test('invalid moves and drops leave the list unchanged and finish dragging', () => {
  const { steps, draggingIndex, editor } = createEditor(['A', 'B'])
  editor.startDrag(0)

  assert.equal(editor.move(0, -1), false)
  assert.equal(editor.drop(0), false)
  assert.deepEqual(steps.map(step => step.name), ['A', 'B'])
  assert.equal(draggingIndex.value, null)
})

test('normalize removes invalid indexes and sorts the remaining selection', () => {
  const { selectedIndexes, editor } = createEditor(['A', 'B', 'C'])
  selectedIndexes.value = [2, -1, 1, 1, 4]

  editor.normalize()

  assert.deepEqual(selectedIndexes.value, [1, 1, 2])
})
