<script setup lang="ts">
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Hash,
  Search,
  ShieldCheck,
  Variable,
  Zap,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

interface BuiltinFunctionItem {
  name: string
  syntax: string
  description: string
  example: string
}

interface BuiltinGroup {
  key: string
  title: string
  tone: 'purple' | 'cyan' | 'orange' | 'blue'
  icon: typeof Hash
  items: BuiltinFunctionItem[]
}

const builtinKeyword = ref('')
const expandedGroups = ref(new Set(['data', 'time']))

const builtinGroups: BuiltinGroup[] = [
  {
    key: 'data',
    title: '数据生成',
    tone: 'purple',
    icon: Hash,
    items: [
      { name: '$faker.name', syntax: '{{$faker.name()}}', description: '随机中文姓名', example: '张伟' },
      { name: '$faker.phone', syntax: '{{$faker.phone()}}', description: '随机手机号', example: '138****5678' },
      { name: '$faker.email', syntax: '{{$faker.email()}}', description: '随机邮箱地址', example: 'user@example.com' },
      { name: '$faker.uuid', syntax: '{{$faker.uuid()}}', description: '随机 UUID v4', example: '550e8400-...' },
      { name: '$faker.idCard', syntax: '{{$faker.idCard()}}', description: '随机身份证号', example: '310...' },
    ],
  },
  {
    key: 'time',
    title: '时间日期',
    tone: 'cyan',
    icon: Clock3,
    items: [
      { name: '$now', syntax: '{{$now}}', description: '当前 ISO 时间戳', example: '2026-08-01T10:00:00Z' },
      { name: '$today', syntax: '{{$today}}', description: '今日日期', example: '2026-08-01' },
      { name: '$timestamp', syntax: '{{$timestamp}}', description: 'Unix 毫秒时间戳', example: '1754035200000' },
      { name: '$dateAdd', syntax: '{{$dateAdd(days)}}', description: '当前日期加 N 天', example: '2026-08-08' },
    ],
  },
  {
    key: 'runtime',
    title: '运行上下文',
    tone: 'orange',
    icon: Zap,
    items: [
      { name: '$run.id', syntax: '{{$run.id}}', description: '当前执行任务 ID', example: 'RUN-20260801-001' },
      { name: '$workspace.code', syntax: '{{$workspace.code}}', description: '当前工作区编码', example: 'QA' },
      { name: '$iteration', syntax: '{{$iteration}}', description: '当前循环序号', example: '1' },
      { name: '$random', syntax: '{{$random}}', description: '运行级随机数', example: '827361' },
    ],
  },
  {
    key: 'crypto',
    title: '加密&编解码',
    tone: 'blue',
    icon: ShieldCheck,
    items: [
      { name: '$md5', syntax: '{{$md5(value)}}', description: '生成 MD5 摘要', example: '098f6bcd...' },
      { name: '$base64', syntax: '{{$base64(value)}}', description: 'Base64 编码', example: 'dGVzdA==' },
      { name: '$urlEncode', syntax: '{{$urlEncode(value)}}', description: 'URL 编码', example: '%E6%B5%8B%E8%AF%95' },
    ],
  },
]

const filteredGroups = computed(() => {
  const keyword = builtinKeyword.value.trim().toLowerCase()
  if (!keyword) return builtinGroups
  return builtinGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => `${item.name} ${item.syntax} ${item.description}`.toLowerCase().includes(keyword)),
    }))
    .filter(group => group.items.length)
})

function isGroupExpanded(key: string) {
  return Boolean(builtinKeyword.value.trim()) || expandedGroups.value.has(key)
}

function toggleGroup(key: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedGroups.value = next
}

async function copySyntax(syntax: string) {
  try {
    await navigator.clipboard.writeText(syntax)
    ElMessage.success('语法已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<template>
  <section class="figma-variable__builtin">
    <header>
      <div class="figma-variable__title-block">
        <h2>内置 &amp; 动态函数</h2>
        <p>只读参考手册。在变量值或响应 Body 中使用 &#123;&#123;函数名&#125;&#125; 语法调用</p>
      </div>
      <label><Search :size="12" /><input v-model="builtinKeyword" type="search" placeholder="搜索函数名、说明"></label>
    </header>

    <div class="figma-variable__builtin-groups">
      <article v-for="group in filteredGroups" :key="group.key" class="figma-variable__builtin-group" :class="[`is-${group.tone}`, { 'is-open': isGroupExpanded(group.key) }]">
        <button type="button" class="figma-variable__builtin-group-head" @click="toggleGroup(group.key)">
          <span><component :is="group.icon" :size="15" /></span>
          <strong>{{ group.title }}</strong>
          <small>{{ group.items.length }} 个函数</small>
          <component :is="isGroupExpanded(group.key) ? ChevronDown : ChevronRight" :size="14" />
        </button>
        <div v-show="isGroupExpanded(group.key)" class="figma-variable__builtin-table">
          <div class="is-head"><span>函数名</span><span>语法</span><span>说明</span><span>示例输出</span></div>
          <button v-for="item in group.items" :key="item.name" type="button" title="点击复制语法" @click="copySyntax(item.syntax)">
            <strong>{{ item.name }}</strong><code>{{ item.syntax }}</code><span>{{ item.description }}</span><code>{{ item.example }}</code>
          </button>
        </div>
      </article>
      <div v-if="!filteredGroups.length" class="figma-variable__empty"><Variable :size="36" /><p>没有找到匹配的函数</p></div>
    </div>
  </section>
</template>

<style scoped>
.figma-variable__builtin button, .figma-variable__builtin input { font: inherit; }
.figma-variable__builtin > header { display: grid; justify-items: start; gap: 10.5px; padding: 17.5px 17.5px 10.5px; }
.figma-variable__title-block h2 { margin: 0; color: #1d2129; font-size: 15px; font-weight: 600; line-height: 22.5px; }
.figma-variable__title-block p { margin: 1.75px 0 0; color: #86909c; font-size: 12px; line-height: 18px; }
.figma-variable__builtin > header label { position: relative; display: flex; align-items: center; justify-self: start; margin: 0; color: #86909c; }
.figma-variable__builtin > header label svg { position: absolute; left: 8.75px; pointer-events: none; }
.figma-variable__builtin > header input { width: 240px; height: 28px; padding: 0 10.5px 0 28px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; color: #1d2129; font-size: 13px; }
.figma-variable__builtin > header input:focus { border-color: var(--variable-primary); box-shadow: 0 0 0 2px rgba(22, 93, 255, .08); }
.figma-variable__builtin-groups { display: grid; gap: 10.5px; padding: 0 17.5px 17.5px; }
.figma-variable__builtin-group { overflow: hidden; border: 1px solid #e5e6eb; border-radius: 11px; background: #fff; }
.figma-variable__builtin-group-head { display: flex; width: 100%; height: 47.5px; align-items: center; gap: 10.5px; padding: 0 14px; border: 0; background: #fff; color: #1d2129; text-align: left; cursor: pointer; }
.figma-variable__builtin-group-head > span { display: grid; width: 24.5px; height: 24.5px; place-items: center; border-radius: 7px; }
.figma-variable__builtin-group-head strong { font-size: 13px; font-weight: 600; }
.figma-variable__builtin-group-head small { flex: 1; color: #c9cdd4; font-size: 12px; }
.figma-variable__builtin-group.is-purple.is-open .figma-variable__builtin-group-head { background: rgba(120, 22, 255, .03); }
.figma-variable__builtin-group.is-purple .figma-variable__builtin-group-head > span { background: #f5f0ff; color: var(--variable-purple); }
.figma-variable__builtin-group.is-cyan.is-open .figma-variable__builtin-group-head { background: rgba(15, 198, 194, .03); }
.figma-variable__builtin-group.is-cyan .figma-variable__builtin-group-head > span { background: #e8fafa; color: var(--variable-cyan); }
.figma-variable__builtin-group.is-orange.is-open .figma-variable__builtin-group-head { background: rgba(255, 125, 0, .03); }
.figma-variable__builtin-group.is-orange .figma-variable__builtin-group-head > span { background: #fff3e8; color: var(--variable-warning); }
.figma-variable__builtin-group.is-blue.is-open .figma-variable__builtin-group-head { background: rgba(22, 93, 255, .03); }
.figma-variable__builtin-group.is-blue .figma-variable__builtin-group-head > span { background: #ebf0ff; color: var(--variable-primary); }
.figma-variable__builtin-table > div, .figma-variable__builtin-table > button { display: grid; grid-template-columns: 200px minmax(260px, 1fr) minmax(260px, 1fr) 140px; gap: 16px; width: 100%; align-items: center; padding: 0 14px; border: 0; border-top: 1px solid #e5e6eb; background: #fff; text-align: left; }
.figma-variable__builtin-table > div { height: 31px; background: #fafafa; color: #86909c; font-size: 11px; font-weight: 600; letter-spacing: .275px; text-transform: uppercase; }
.figma-variable__builtin-table > button { min-height: 41.5px; color: #4e5969; font-size: 12px; cursor: pointer; }
.figma-variable__builtin-table > button:hover { background: #fafafa; }
.figma-variable__builtin-table strong { color: inherit; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
.figma-variable__builtin-group.is-purple .figma-variable__builtin-table strong, .figma-variable__builtin-group.is-purple .figma-variable__builtin-table code { color: var(--variable-purple); }
.figma-variable__builtin-group.is-cyan .figma-variable__builtin-table strong, .figma-variable__builtin-group.is-cyan .figma-variable__builtin-table code { color: var(--variable-cyan); }
.figma-variable__builtin-group.is-orange .figma-variable__builtin-table strong, .figma-variable__builtin-group.is-orange .figma-variable__builtin-table code { color: var(--variable-warning); }
.figma-variable__builtin-group.is-blue .figma-variable__builtin-table strong, .figma-variable__builtin-group.is-blue .figma-variable__builtin-table code { color: var(--variable-primary); }
.figma-variable__builtin-table code { justify-self: start; padding: 1.75px 7px; border-radius: 3.5px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11px; }
.figma-variable__builtin-group.is-purple .figma-variable__builtin-table button > code:first-of-type { background: rgba(120, 22, 255, .06); }
.figma-variable__builtin-group.is-cyan .figma-variable__builtin-table button > code:first-of-type { background: rgba(15, 198, 194, .06); }
.figma-variable__builtin-group.is-orange .figma-variable__builtin-table button > code:first-of-type { background: rgba(255, 125, 0, .06); }
.figma-variable__builtin-group.is-blue .figma-variable__builtin-table button > code:first-of-type { background: rgba(22, 93, 255, .06); }
.figma-variable__builtin-table button > code:last-child { padding: 0; background: transparent; color: #86909c !important; }
.figma-variable__empty { display: flex; min-height: 250px; align-items: center; justify-content: center; flex-direction: column; gap: 10.5px; color: #c9cdd4; }
.figma-variable__empty p { margin: 0; color: #86909c; font-size: 13px; }
</style>
