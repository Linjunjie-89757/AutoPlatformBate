export const APP_FIGMA_ACTION_COLUMN_MIN_WIDTH = 120
export const APP_FIGMA_ACTION_COLUMN_MAX_WIDTH = 176
export const APP_FIGMA_ACTION_BUTTON_SIZE = 24.5
export const APP_FIGMA_ACTION_COLUMN_GUTTER = 48

export function getAppFigmaActionColumnWidth(actionCount: number) {
  const normalizedCount = Math.min(Math.max(Math.floor(actionCount), 1), 5)
  const contentWidth = normalizedCount * APP_FIGMA_ACTION_BUTTON_SIZE + APP_FIGMA_ACTION_COLUMN_GUTTER
  const roundedWidth = Math.ceil(contentWidth / 8) * 8
  return Math.min(APP_FIGMA_ACTION_COLUMN_MAX_WIDTH, Math.max(APP_FIGMA_ACTION_COLUMN_MIN_WIDTH, roundedWidth))
}
