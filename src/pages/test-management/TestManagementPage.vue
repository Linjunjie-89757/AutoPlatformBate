<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Target,
  TestTube2,
  X,
} from '@lucide/vue'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import {
  planDemoData,
  requirementDemoData,
  versionDemoData,
  type RequirementItem,
  type TestPlanItem,
  type VersionItem,
} from './testManagementDemoData'
import VersionManagementPanel from './VersionManagementPanel.vue'
import './test-management-page.css'

type ActiveTab = 'requirements' | 'versions' | 'plans'
type DetailRecord = RequirementItem | VersionItem | TestPlanItem

const activeTab = ref<ActiveTab>('versions')
const keyword = ref('')
const versionFilter = ref('全部版本')
const statusFilter = ref('全部状态')
const requirements = ref<RequirementItem[]>([...requirementDemoData])
const drawerRecord = ref<DetailRecord | null>(null)
const createDialogOpen = ref(false)
const formError = ref('')
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const createForm = reactive({
  title: '',
  version: 'v2.6.0',
  owner: '',
  description: '',
})

const tabs: Array<{ key: ActiveTab; label: string; count: number }> = [
  { key: 'requirements', label: '需求管理', count: requirements.value.length },
  { key: 'versions', label: '版本管理', count: versionDemoData.length },
  { key: 'plans', label: '测试计划', count: planDemoData.length },
]

const statusOptions = computed(() => {
  if (activeTab.value === 'requirements') return ['全部状态', '评审中', '开发中', '测试中', '已完成']
  if (activeTab.value === 'versions') return ['全部状态', '规划中', '测试中', '待发布', '已发布']
  return ['全部状态', '未开始', '进行中', '已完成']
})

const pageDescription = computed(() => {
  if (activeTab.value === 'requirements') return '从业务需求追溯 AI 生成、测试用例、执行结果和缺陷。'
  if (activeTab.value === 'versions') return '聚合版本范围、测试进度与发布风险，辅助质量准出判断。'
  return '按测试目标组织用例范围、执行进度和缺陷闭环。'
})

const filteredRequirements = computed(() => requirements.value.filter((item) => {
  const matchesKeyword = !keyword.value || `${item.id}${item.title}${item.owner}`.toLowerCase().includes(keyword.value.toLowerCase())
  const matchesVersion = versionFilter.value === '全部版本' || item.version === versionFilter.value
  const matchesStatus = statusFilter.value === '全部状态' || item.status === statusFilter.value
  return matchesKeyword && matchesVersion && matchesStatus
}))

const filteredVersions = computed(() => versionDemoData.filter((item) => {
  const matchesKeyword = !keyword.value || `${item.id}${item.name}${item.owner}`.toLowerCase().includes(keyword.value.toLowerCase())
  const matchesVersion = versionFilter.value === '全部版本' || item.name === versionFilter.value
  const matchesStatus = statusFilter.value === '全部状态' || item.status === statusFilter.value
  return matchesKeyword && matchesVersion && matchesStatus
}))

const filteredPlans = computed(() => planDemoData.filter((item) => {
  const matchesKeyword = !keyword.value || `${item.id}${item.name}${item.owner}`.toLowerCase().includes(keyword.value.toLowerCase())
  const matchesVersion = versionFilter.value === '全部版本' || item.version === versionFilter.value
  const matchesStatus = statusFilter.value === '全部状态' || item.status === statusFilter.value
  return matchesKeyword && matchesVersion && matchesStatus
}))

const resultCount = computed(() => {
  if (activeTab.value === 'requirements') return filteredRequirements.value.length
  if (activeTab.value === 'versions') return filteredVersions.value.length
  return filteredPlans.value.length
})

const currentTabLabel = computed(() => tabs.find(item => item.key === activeTab.value)?.label || '')

const isRequirement = (record: DetailRecord): record is RequirementItem => 'title' in record
const isVersion = (record: DetailRecord): record is VersionItem => 'releaseDate' in record
const isPlan = (record: DetailRecord): record is TestPlanItem => 'scope' in record

const statusClass = (status: string) => ({
  '评审中': 'is-review',
  '规划中': 'is-review',
  '开发中': 'is-developing',
  '测试中': 'is-testing',
  '进行中': 'is-testing',
  '待发布': 'is-pending',
  '已完成': 'is-complete',
  '已发布': 'is-complete',
  '未开始': 'is-muted',
}[status] || 'is-muted')

const changeTab = (tab: ActiveTab) => {
  activeTab.value = tab
  keyword.value = ''
  versionFilter.value = '全部版本'
  statusFilter.value = '全部状态'
}

const showToast = (message: string) => {
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2400)
}

const openCreateDialog = () => {
  formError.value = ''
  createDialogOpen.value = true
}

const closeCreateDialog = () => {
  createDialogOpen.value = false
  formError.value = ''
}

const createRequirement = () => {
  if (!createForm.title.trim()) {
    formError.value = '请输入需求标题'
    return
  }
  if (!createForm.owner.trim()) {
    formError.value = '请输入负责人'
    return
  }

  requirements.value.unshift({
    id: `REQ-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    title: createForm.title.trim(),
    version: createForm.version,
    owner: createForm.owner.trim(),
    status: '评审中',
    cases: 0,
    passed: 0,
    defects: 0,
    aiRecords: 0,
    updatedAt: '刚刚',
    description: createForm.description.trim() || '暂未填写需求说明。',
  })
  createForm.title = ''
  createForm.owner = ''
  createForm.description = ''
  closeCreateDialog()
  activeTab.value = 'requirements'
  showToast('需求已添加到演示列表')
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <VersionManagementPanel v-if="activeTab === 'versions'" @change-tab="changeTab" />
  <main v-else class="test-management-page">
    <header class="test-management-page__header">
      <div>
        <div class="test-management-page__eyebrow">
          <ClipboardCheck :size="14" />
          工作区质量协作
        </div>
        <h1>测试管理</h1>
        <p>{{ pageDescription }}</p>
      </div>
      <button class="test-management-page__primary-button" type="button" @click="openCreateDialog">
        <Plus :size="15" />
        新建需求
      </button>
    </header>

    <nav class="test-management-page__tabs" aria-label="测试管理视图">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ 'is-active': activeTab === tab.key }"
        @click="changeTab(tab.key)"
      >
        {{ tab.label }}
        <span>{{ tab.key === 'requirements' ? requirements.length : tab.count }}</span>
      </button>
    </nav>

    <section class="test-management-page__metrics" aria-label="质量概览">
      <div class="test-management-page__metric">
        <span class="test-management-page__metric-icon is-blue"><FileText :size="17" /></span>
        <div><strong>24</strong><span>本期需求</span></div>
        <small>18 项已覆盖</small>
      </div>
      <div class="test-management-page__metric">
        <span class="test-management-page__metric-icon is-green"><ListChecks :size="17" /></span>
        <div><strong>326</strong><span>关联用例</span></div>
        <small>覆盖率 87.5%</small>
      </div>
      <div class="test-management-page__metric">
        <span class="test-management-page__metric-icon is-orange"><TestTube2 :size="17" /></span>
        <div><strong>78%</strong><span>执行进度</span></div>
        <small>通过率 92.1%</small>
      </div>
      <div class="test-management-page__metric">
        <span class="test-management-page__metric-icon is-red"><AlertTriangle :size="17" /></span>
        <div><strong>9</strong><span>未关闭缺陷</span></div>
        <small>2 个高优先级</small>
      </div>
    </section>

    <section class="test-management-page__trace" aria-label="需求质量追溯链路">
      <div class="test-management-page__trace-title">
        <Target :size="16" />
        <span><strong>需求质量追溯</strong><small>每个结果都可回到业务需求</small></span>
      </div>
      <div class="test-management-page__trace-flow">
        <span><FileText :size="14" />需求</span><ArrowRight :size="14" />
        <span><Bot :size="14" />AI 生成</span><ArrowRight :size="14" />
        <span><FileCheck2 :size="14" />用例</span><ArrowRight :size="14" />
        <span><TestTube2 :size="14" />执行</span><ArrowRight :size="14" />
        <span><AlertTriangle :size="14" />缺陷</span>
      </div>
      <button type="button" @click="showToast('已展示完整追溯链路')">
        查看链路
        <ChevronRight :size="14" />
      </button>
    </section>

    <section class="test-management-page__content">
      <div class="test-management-page__toolbar">
        <div class="test-management-page__search">
          <Search :size="15" />
          <input v-model="keyword" type="search" :placeholder="`搜索${currentTabLabel}名称或负责人`">
        </div>
        <select v-model="versionFilter" aria-label="版本筛选">
          <option>全部版本</option>
          <option>v2.7.0</option>
          <option>v2.6.0</option>
          <option>v2.5.2</option>
          <option>v2.5.1</option>
        </select>
        <select v-model="statusFilter" aria-label="状态筛选">
          <option v-for="status in statusOptions" :key="status">{{ status }}</option>
        </select>
        <span class="test-management-page__result-count">共 {{ resultCount }} 条</span>
      </div>

      <div class="test-management-page__table-wrap">
        <table v-if="activeTab === 'requirements'" class="test-management-page__table">
          <thead><tr><th>需求</th><th>所属版本</th><th>负责人</th><th>覆盖情况</th><th>缺陷</th><th>状态</th><th>更新时间</th><th></th></tr></thead>
          <tbody>
            <tr v-for="item in filteredRequirements" :key="item.id" tabindex="0" @click="drawerRecord = item" @keydown.enter="drawerRecord = item">
              <td><div class="test-management-page__primary-cell"><strong>{{ item.title }}</strong><small>{{ item.id }}</small></div></td>
              <td><span class="test-management-page__version-tag">{{ item.version }}</span></td>
              <td>{{ item.owner }}</td>
              <td><div class="test-management-page__coverage"><span>{{ item.cases ? `${item.passed}/${item.cases}` : '-' }}</span><div><i :style="{ width: item.cases ? `${item.passed / item.cases * 100}%` : '0%' }"></i></div></div></td>
              <td><span :class="['test-management-page__defect-count', { 'has-defects': item.defects }]">{{ item.defects }}</span></td>
              <td><span :class="['test-management-page__status', statusClass(item.status)]">{{ item.status }}</span></td>
              <td class="test-management-page__muted-cell">{{ item.updatedAt }}</td>
              <td><button class="test-management-page__row-button" type="button" aria-label="查看需求详情" @click.stop="drawerRecord = item"><ChevronRight :size="15" /></button></td>
            </tr>
          </tbody>
        </table>

        <table v-else class="test-management-page__table">
          <thead><tr><th>测试计划</th><th>所属版本</th><th>负责人</th><th>测试范围</th><th>执行进度</th><th>通过率</th><th>计划结束</th><th>状态</th><th></th></tr></thead>
          <tbody>
            <tr v-for="item in filteredPlans" :key="item.id" tabindex="0" @click="drawerRecord = item" @keydown.enter="drawerRecord = item">
              <td><div class="test-management-page__primary-cell"><strong>{{ item.name }}</strong><small>{{ item.id }}</small></div></td>
              <td><span class="test-management-page__version-tag">{{ item.version }}</span></td>
              <td>{{ item.owner }}</td>
              <td>{{ item.scope }}</td>
              <td><div class="test-management-page__coverage is-wide"><span>{{ item.executed }}/{{ item.cases }}</span><div><i :style="{ width: `${item.cases ? item.executed / item.cases * 100 : 0}%` }"></i></div></div></td>
              <td>{{ item.executed ? `${Math.round(item.passed / item.executed * 100)}%` : '-' }}</td>
              <td><span class="test-management-page__date"><CalendarDays :size="13" />{{ item.endDate }}</span></td>
              <td><span :class="['test-management-page__status', statusClass(item.status)]">{{ item.status }}</span></td>
              <td><button class="test-management-page__row-button" type="button" aria-label="查看计划详情" @click.stop="drawerRecord = item"><ChevronRight :size="15" /></button></td>
            </tr>
          </tbody>
        </table>

        <div v-if="resultCount === 0" class="test-management-page__empty">
          <Search :size="28" />
          <strong>没有找到匹配结果</strong>
          <span>调整搜索词或筛选条件后重试</span>
        </div>
      </div>
    </section>

    <Transition name="test-management-fade">
      <div v-if="drawerRecord" class="test-management-page__overlay" @click.self="drawerRecord = null">
        <aside class="test-management-page__drawer" aria-label="详情抽屉">
          <header>
            <div>
              <span>{{ isRequirement(drawerRecord) ? '需求详情' : isVersion(drawerRecord) ? '版本详情' : '测试计划详情' }}</span>
              <h2>{{ isRequirement(drawerRecord) ? drawerRecord.title : drawerRecord.name }}</h2>
            </div>
            <button type="button" aria-label="关闭详情" @click="drawerRecord = null"><X :size="18" /></button>
          </header>

          <template v-if="isRequirement(drawerRecord)">
            <div class="test-management-page__drawer-meta">
              <span>{{ drawerRecord.id }}</span>
              <span class="test-management-page__version-tag">{{ drawerRecord.version }}</span>
              <span :class="['test-management-page__status', statusClass(drawerRecord.status)]">{{ drawerRecord.status }}</span>
            </div>
            <section class="test-management-page__drawer-section">
              <h3>需求说明</h3>
              <p>{{ drawerRecord.description }}</p>
            </section>
            <section class="test-management-page__drawer-section">
              <h3>质量链路</h3>
              <div class="test-management-page__drawer-trace">
                <button type="button" @click="showToast('已定位到 AI 生成记录')"><Sparkles :size="16" /><span><strong>{{ drawerRecord.aiRecords }}</strong><small>AI 生成记录</small></span></button>
                <button type="button" @click="showToast('已定位到关联用例')"><FileCheck2 :size="16" /><span><strong>{{ drawerRecord.cases }}</strong><small>关联用例</small></span></button>
                <button type="button" @click="showToast('已定位到执行结果')"><TestTube2 :size="16" /><span><strong>{{ drawerRecord.passed }}</strong><small>通过用例</small></span></button>
                <button type="button" @click="showToast('已定位到关联缺陷')"><AlertTriangle :size="16" /><span><strong>{{ drawerRecord.defects }}</strong><small>关联缺陷</small></span></button>
              </div>
            </section>
            <section class="test-management-page__drawer-section">
              <h3>基本信息</h3>
              <dl><div><dt>负责人</dt><dd>{{ drawerRecord.owner }}</dd></div><div><dt>最近更新</dt><dd>{{ drawerRecord.updatedAt }}</dd></div></dl>
            </section>
          </template>

          <template v-else-if="isVersion(drawerRecord)">
            <div class="test-management-page__drawer-meta">
              <span>{{ drawerRecord.id }}</span>
              <span :class="['test-management-page__status', statusClass(drawerRecord.status)]">{{ drawerRecord.status }}</span>
              <span :class="['test-management-page__risk', `is-${drawerRecord.risk}`]">{{ drawerRecord.risk }}风险</span>
            </div>
            <section class="test-management-page__quality-gate">
              <div><CheckCircle2 :size="20" /><span><strong>质量准出检查</strong><small>5 项规则通过，1 项需要关注</small></span></div>
              <strong>{{ drawerRecord.progress }}%</strong>
            </section>
            <section class="test-management-page__drawer-section">
              <h3>版本概览</h3>
              <dl><div><dt>需求数量</dt><dd>{{ drawerRecord.requirements }}</dd></div><div><dt>测试计划</dt><dd>{{ drawerRecord.plans }}</dd></div><div><dt>未关闭缺陷</dt><dd>{{ drawerRecord.openDefects }}</dd></div><div><dt>计划发布日期</dt><dd>{{ drawerRecord.releaseDate }}</dd></div><div><dt>负责人</dt><dd>{{ drawerRecord.owner }}</dd></div></dl>
            </section>
          </template>

          <template v-else-if="isPlan(drawerRecord)">
            <div class="test-management-page__drawer-meta">
              <span>{{ drawerRecord.id }}</span>
              <span class="test-management-page__version-tag">{{ drawerRecord.version }}</span>
              <span :class="['test-management-page__status', statusClass(drawerRecord.status)]">{{ drawerRecord.status }}</span>
            </div>
            <section class="test-management-page__plan-progress">
              <div><span>执行进度</span><strong>{{ drawerRecord.executed }} / {{ drawerRecord.cases }}</strong></div>
              <div><i :style="{ width: `${drawerRecord.cases ? drawerRecord.executed / drawerRecord.cases * 100 : 0}%` }"></i></div>
            </section>
            <section class="test-management-page__drawer-section">
              <h3>计划信息</h3>
              <dl><div><dt>测试范围</dt><dd>{{ drawerRecord.scope }}</dd></div><div><dt>负责人</dt><dd>{{ drawerRecord.owner }}</dd></div><div><dt>通过用例</dt><dd>{{ drawerRecord.passed }}</dd></div><div><dt>计划结束</dt><dd>{{ drawerRecord.endDate }}</dd></div></dl>
            </section>
          </template>

          <footer>
            <button type="button" @click="drawerRecord = null">关闭</button>
            <button type="button" class="is-primary" @click="showToast('Demo 暂不跳转到业务页面')">查看完整详情</button>
          </footer>
        </aside>
      </div>
    </Transition>

    <Transition name="test-management-fade">
      <div v-if="createDialogOpen" class="test-management-page__overlay is-dialog" @click.self="closeCreateDialog">
        <section class="test-management-page__dialog" role="dialog" aria-modal="true" aria-labelledby="create-requirement-title">
          <header>
            <div><h2 id="create-requirement-title">新建需求</h2><p>创建后可继续关联 AI 生成记录、测试用例与缺陷。</p></div>
            <button type="button" aria-label="关闭弹窗" @click="closeCreateDialog"><X :size="18" /></button>
          </header>
          <div class="test-management-page__form">
            <label><span>需求标题 <i>*</i></span><input v-model="createForm.title" type="text" placeholder="请输入需求标题" @input="formError = ''"></label>
            <div class="test-management-page__form-row">
              <label><span>所属版本</span><select v-model="createForm.version"><option>v2.7.0</option><option>v2.6.0</option><option>v2.5.2</option></select></label>
              <label><span>负责人 <i>*</i></span><input v-model="createForm.owner" type="text" placeholder="请输入负责人" @input="formError = ''"></label>
            </div>
            <label><span>需求说明</span><textarea v-model="createForm.description" rows="4" placeholder="描述业务目标、范围和验收条件"></textarea></label>
            <p v-if="formError" class="test-management-page__form-error">{{ formError }}</p>
          </div>
          <footer><button type="button" @click="closeCreateDialog">取消</button><button type="button" class="is-primary" @click="createRequirement">创建需求</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="test-management-toast">
      <div v-if="toastMessage" class="test-management-page__toast"><CheckCircle2 :size="16" />{{ toastMessage }}</div>
    </Transition>
  </main>
</template>
