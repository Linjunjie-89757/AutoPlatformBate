<template>
  <div
    class="api-code-editor"
    :class="{
      'is-fit-content': fitContent,
      'is-plain': plain,
      'is-fill': fill,
      'is-dark': themeVariant !== 'light',
      'is-figma-dark': themeVariant === 'figma-dark',
    }"
    :style="editorShellStyle"
  >
    <div v-if="showToolbar" class="api-code-editor__toolbar">
      <div class="api-code-editor__toolbar-left">
        <slot name="toolbar"></slot>
      </div>
      <button v-if="showFormatButton" type="button" class="api-code-editor__format" @click="formatDocument">格式化</button>
    </div>
    <div ref="containerRef" class="api-code-editor__body" :style="editorBodyStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution'
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

type ApiCodeLanguage = 'api-console' | 'javascript' | 'json' | 'sql' | 'text' | 'xml'

const API_CONSOLE_LANGUAGE = 'api-console'
const API_CODE_THEME = 'api-code-light'
const API_CODE_DARK_THEME = 'api-code-dark'
const API_CODE_FIGMA_DARK_THEME = 'api-code-figma-dark'
let apiConsoleLanguageReady = false

const props = withDefaults(defineProps<{
  modelValue?: string | null
  language?: ApiCodeLanguage
  height?: string
  readOnly?: boolean
  showFormatButton?: boolean
  placeholder?: string
  lineNumbers?: 'on' | 'off'
  folding?: boolean
  fitContent?: boolean
  fill?: boolean
  plain?: boolean
  minFitContentHeight?: number
  maxFitContentHeight?: number
  themeVariant?: 'light' | 'dark' | 'figma-dark'
  fontSize?: number
  lineHeight?: number
  paddingTop?: number
  paddingBottom?: number
  lineDecorationsWidth?: number
}>(), {
  language: 'javascript',
  height: '260px',
  readOnly: false,
  showFormatButton: true,
  placeholder: '',
  lineNumbers: 'on',
  folding: true,
  fitContent: false,
  fill: false,
  plain: false,
  minFitContentHeight: 120,
  maxFitContentHeight: 1000,
  themeVariant: 'light',
  fontSize: 14,
  lineHeight: 0,
  paddingTop: 12,
  paddingBottom: 12,
  lineDecorationsWidth: 0,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const slots = useSlots()
const containerRef = ref<HTMLDivElement | null>(null)
const bodyHeight = ref(props.height)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let suppressModelSync = false

const showToolbar = computed(() => !props.readOnly && (props.showFormatButton || Boolean(slots.toolbar)))
const editorShellStyle = computed(() => {
  if (props.fitContent) {
    return { height: 'auto' }
  }

  if (props.fill) {
    return {}
  }

  return { height: props.height }
})
const editorBodyStyle = computed(() => (props.fitContent ? { height: bodyHeight.value } : {}))

function mapLanguage(language: ApiCodeLanguage) {
  return language === 'text' ? 'plaintext' : language
}

function ensureApiConsoleLanguage() {
  if (apiConsoleLanguageReady) {
    return
  }

  if (!monaco.languages.getLanguages().some(item => item.id === API_CONSOLE_LANGUAGE)) {
    monaco.languages.register({ id: API_CONSOLE_LANGUAGE })
  }

  monaco.languages.setMonarchTokensProvider(API_CONSOLE_LANGUAGE, {
    tokenizer: {
      root: [
        [/^\[Error\].*$/, 'api-console-error'],
        [/^\[(?:Processor|Assertion|Extraction)\s+\d+\].*\bFAIL\b.*$/, 'api-console-fail'],
        [/^\[(?:Processor|Assertion|Extraction)\s+\d+\].*\b(?:PASS|OK)\b.*$/, 'api-console-pass'],
        [/\b(?:Error|FAIL)\b/, 'api-console-fail'],
        [/\b(?:PASS|OK)\b/, 'api-console-pass'],
        [/\b(?:expected|actual|outputVariables):/, 'api-console-key'],
        [/\b\d+(?:\.\d+)?(?:\s*(?:ms|B|KB|MB))?\b/, 'api-console-number'],
      ],
    },
  })

  monaco.editor.defineTheme(API_CODE_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'api-console-error', foreground: 'dc2626', fontStyle: 'bold' },
      { token: 'api-console-fail', foreground: 'dc2626', fontStyle: 'bold' },
      { token: 'api-console-pass', foreground: '16a34a', fontStyle: 'bold' },
      { token: 'api-console-key', foreground: '2563eb' },
      { token: 'api-console-number', foreground: '9333ea' },
    ],
    colors: {},
  })

  monaco.editor.defineTheme(API_CODE_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1E1E2E',
      'editor.foreground': '#CDD6F4',
      'editorLineNumber.foreground': '#565675',
      'editorLineNumber.activeForeground': '#7C7C9A',
      'editor.lineHighlightBackground': '#2D2D3F66',
      'editorCursor.foreground': '#CBA6F7',
      'editor.selectionBackground': '#45475A',
      'editor.inactiveSelectionBackground': '#313244',
    },
  })

  monaco.editor.defineTheme(API_CODE_FIGMA_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '9CDCFE' },
      { token: 'string.value.json', foreground: 'CE9178' },
      { token: 'delimiter.bracket.json', foreground: '569CD6' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#D4D4D4',
      'editor.lineHighlightBackground': '#FFFFFF0A',
      'editorCursor.foreground': '#D4D4D4',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41',
    },
  })

  apiConsoleLanguageReady = true
}

function ensureMonacoWorkers() {
  const globalWithMonaco = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_: string, label: string) => Worker
    }
  }

  globalWithMonaco.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') {
        return new jsonWorker()
      }
      return new editorWorker()
    },
  }
}

async function formatDocument() {
  if (!editor) {
    return
  }
  await editor.getAction('editor.action.formatDocument')?.run()
}

defineExpose({
  formatDocument,
})

function syncEditorHeight() {
  if (!props.fitContent || !editor) {
    return
  }
  const nextHeight = Math.max(props.minFitContentHeight, Math.min(editor.getContentHeight(), props.maxFitContentHeight))
  bodyHeight.value = `${nextHeight}px`
  editor.layout()
}

function resolveEditorFontFamily() {
  return window.getComputedStyle(document.documentElement)
    .getPropertyValue('--app-font-family-mono')
    .trim() || 'monospace'
}

function resolveEditorTheme(themeVariant = props.themeVariant) {
  if (themeVariant === 'figma-dark') {
    return API_CODE_FIGMA_DARK_THEME
  }
  return themeVariant === 'dark' ? API_CODE_DARK_THEME : API_CODE_THEME
}

function createEditor() {
  if (!containerRef.value) {
    return
  }

  bodyHeight.value = props.height
  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue ?? '',
    language: mapLanguage(props.language),
    theme: resolveEditorTheme(),
    readOnly: props.readOnly,
    automaticLayout: true,
    fontFamily: resolveEditorFontFamily(),
    fontSize: props.fontSize,
    lineHeight: props.lineHeight,
    minimap: { enabled: false },
    contextmenu: !props.readOnly,
    lineNumbers: props.lineNumbers,
    lineNumbersMinChars: 3,
    lineDecorationsWidth: props.lineDecorationsWidth,
    glyphMargin: false,
    folding: props.folding,
    tabSize: 2,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    roundedSelection: false,
    renderLineHighlight: props.themeVariant === 'figma-dark' ? 'none' : 'line',
    bracketPairColorization: { enabled: props.themeVariant !== 'figma-dark' },
    scrollbar: {
      alwaysConsumeMouseWheel: false,
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    padding: {
      top: props.paddingTop,
      bottom: props.paddingBottom,
    },
    ariaLabel: props.placeholder || 'code editor',
  })
  editor.getModel()?.setEOL(monaco.editor.EndOfLineSequence.LF)
  if (props.fitContent) {
    editor.onDidContentSizeChange(() => {
      syncEditorHeight()
    })
    syncEditorHeight()
  }
  editor.onDidChangeModelContent(() => {
    if (!editor || suppressModelSync) {
      return
    }
    const value = editor.getValue()
    emit('update:modelValue', value)
    emit('change', value)
  })
}

watch(
  () => props.modelValue,
  (value) => {
    const nextValue = value ?? ''
    if (!editor || editor.getValue() === nextValue) {
      return
    }
    suppressModelSync = true
    editor.setValue(nextValue)
    suppressModelSync = false
    syncEditorHeight()
  },
)

watch(
  () => props.language,
  (language) => {
    const model = editor?.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, mapLanguage(language))
      syncEditorHeight()
    }
  },
)

watch(
  () => props.readOnly,
  (readOnly) => {
    editor?.updateOptions({
      readOnly,
      contextmenu: !readOnly,
    })
    syncEditorHeight()
  },
)

watch(
  () => props.themeVariant,
  (themeVariant) => {
    monaco.editor.setTheme(resolveEditorTheme(themeVariant))
    editor?.updateOptions({
      renderLineHighlight: themeVariant === 'figma-dark' ? 'none' : 'line',
      bracketPairColorization: { enabled: themeVariant !== 'figma-dark' },
    })
  },
)

watch(
  () => [props.lineNumbers, props.folding] as const,
  ([lineNumbers, folding]) => {
    editor?.updateOptions({
      lineNumbers,
      folding,
    })
    syncEditorHeight()
  },
)

watch(
  () => [props.fontSize, props.lineHeight, props.paddingTop, props.paddingBottom, props.lineDecorationsWidth] as const,
  ([fontSize, lineHeight, paddingTop, paddingBottom, lineDecorationsWidth]) => {
    editor?.updateOptions({
      fontSize,
      lineHeight,
      lineDecorationsWidth,
      padding: {
        top: paddingTop,
        bottom: paddingBottom,
      },
    })
    syncEditorHeight()
  },
)

watch(
  () => props.height,
  (height) => {
    if (!props.fitContent) {
      bodyHeight.value = height
    }
  },
)

onMounted(() => {
  ensureMonacoWorkers()
  ensureApiConsoleLanguage()
  createEditor()
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})
</script>

<style scoped>
.api-code-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  padding: 10px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: #fff;
  overflow: hidden;
}

.api-code-editor.is-fit-content {
  min-height: 0;
}

.api-code-editor.is-fill {
  height: 100%;
  flex: 1 1 auto;
}

.api-code-editor.is-plain {
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-code-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: space-between;
  padding: 0 0 8px;
  background: #fff;
}

.api-code-editor__toolbar-left {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.api-code-editor__format {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-sm);
  background: #fff;
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;
}

.api-code-editor__format:hover {
  border-color: var(--app-border-strong);
  background: var(--app-bg-soft);
  color: var(--app-primary);
}

.api-code-editor__body {
  flex: 1 1 auto;
  min-height: 0;
}

.api-code-editor__body :deep(.monaco-editor),
.api-code-editor__body :deep(.overflow-guard) {
  border-radius: 0;
}

.api-code-editor.is-dark {
  flex: 0 0 auto;
  padding: 1px;
  border-color: #e5e6eb;
  border-radius: 7px;
  background: #1e1e2e;
}

.api-code-editor.is-figma-dark {
  background: #1e1e1e;
}

.api-code-editor.is-dark .api-code-editor__toolbar {
  padding: 5.25px 10.5px 6.25px;
  border-bottom: 1px solid #2d2d3f;
  background: #16162a;
}

.api-code-editor.is-dark .api-code-editor__format {
  height: 20px;
  padding: 0 6px;
  border-color: #2d2d3f;
  background: #2d2d3f;
  color: #7c7c9a;
  font-size: 10px;
  line-height: 18px;
}
</style>
