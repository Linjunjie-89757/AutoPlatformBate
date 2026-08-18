<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

import RequirementManagementPanel from './RequirementManagementPanel.vue'
import TestPlanManagementPanel from './TestPlanManagementPanel.vue'
import VersionManagementPanel from './VersionManagementPanel.vue'

type ActiveTab = 'requirements' | 'versions' | 'plans'
type DetailState = { id: string | null; tab: string | null }

const route = useRoute()
const router = useRouter()
const queryValue = (value: unknown) => Array.isArray(value) ? String(value[0] || '') : typeof value === 'string' ? value : ''
const normalizeTab = (value: unknown): ActiveTab => {
  const tab = queryValue(value)
  return tab === 'requirements' || tab === 'plans' ? tab : 'versions'
}

const activeTab = ref<ActiveTab>(normalizeTab(route.query.tmView))
const initialDetailId = computed(() => queryValue(route.query.tmId) || null)
const initialDetailTab = computed(() => queryValue(route.query.tmTab) || null)

const replaceRouteState = (tab: ActiveTab, state?: DetailState) => {
  const query: LocationQueryRaw = { ...route.query, tmView: tab }
  if (state?.id) {
    query.tmId = state.id
    if (state.tab) query.tmTab = state.tab
    else delete query.tmTab
  } else {
    delete query.tmId
    delete query.tmTab
  }
  void router.replace({ query })
}

const changeTab = (tab: ActiveTab) => {
  activeTab.value = tab
  replaceRouteState(tab)
}

const changeDetailState = (state: DetailState) => replaceRouteState(activeTab.value, state)

watch(() => route.query.tmView, value => {
  activeTab.value = normalizeTab(value)
})
</script>

<template>
  <VersionManagementPanel
    v-if="activeTab === 'versions'"
    :initial-detail-id="initialDetailId"
    :initial-detail-tab="initialDetailTab"
    @change-tab="changeTab"
    @detail-state-change="changeDetailState"
  />
  <RequirementManagementPanel
    v-else-if="activeTab === 'requirements'"
    :initial-detail-id="initialDetailId"
    :initial-detail-tab="initialDetailTab"
    @change-tab="changeTab"
    @detail-state-change="changeDetailState"
  />
  <TestPlanManagementPanel
    v-else
    :initial-detail-id="initialDetailId"
    :initial-detail-tab="initialDetailTab"
    @change-tab="changeTab"
    @detail-state-change="changeDetailState"
  />
  <!-- Legacy generic test-management template retained temporarily for source comparison.
  <main class="test-management-page">
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
        <table class="test-management-page__table">
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
  -->
</template>
