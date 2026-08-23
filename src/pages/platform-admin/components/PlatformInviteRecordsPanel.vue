<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Send, X, AlertTriangle } from '@lucide/vue'

import { platformAdminApi, type PlatformAccountInvitationItem } from '@/entities/platform-admin'
import { getRequestErrorMessage } from '@/shared/api/error'

type InviteStatus = 'PENDING_SEND' | 'SENDING' | 'SENT' | 'ACTIVATED' | 'EXPIRED' | 'REVOKED' | 'FAILED' | string
type SourceFilter = 'ALL' | 'MANUAL' | 'BATCH'
type StatusFilter = 'ALL' | 'PENDING_SEND' | 'SENDING' | 'FAILED' | 'SENT' | 'ACTIVATED' | 'EXPIRED' | 'REVOKED'

const emit = defineEmits<{
  stats: [total: number, failed: number]
}>()

const records = ref<PlatformAccountInvitationItem[]>([])
const loading = ref(true)
const errorMessage = ref('')
const query = ref('')
const sourceFilter = ref<SourceFilter>('ALL')
const statusFilter = ref<StatusFilter>('ALL')
const detailId = ref<number | null>(null)
const resendId = ref<number | null>(null)
const revokeId = ref<number | null>(null)
const actionId = ref<number | null>(null)
const sendingIds = ref<Set<number>>(new Set())

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_SEND: { label: '待发送', color: '#86909c', bg: '#f2f3f5' },
  SENDING: { label: '发送中', color: '#165dff', bg: '#ebf3ff' },
  SENT: { label: '待激活', color: '#ff7d00', bg: '#fff5eb' },
  ACTIVATED: { label: '已激活', color: '#00b42a', bg: '#e8ffea' },
  EXPIRED: { label: '已过期', color: '#c9cdd4', bg: '#f2f3f5' },
  REVOKED: { label: '已撤销', color: '#86909c', bg: '#f2f3f5' },
  FAILED: { label: '发送失败', color: '#f53f3f', bg: '#fff0f0' },
}

const filteredRecords = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  return records.value.filter(record => {
    const status = displayStatus(record)
    if (statusFilter.value !== 'ALL' && status !== statusFilter.value) return false
    if (sourceFilter.value !== 'ALL' && normalizedSource(record.source) !== sourceFilter.value) return false
    if (!normalized) return true
    return record.displayName.toLowerCase().includes(normalized) || record.email.toLowerCase().includes(normalized)
  })
})

const failedCount = computed(() => records.value.filter(record => normalizedStatus(record.status) === 'FAILED').length)
const pendingCount = computed(() => records.value.filter(record => ['PENDING_SEND', 'SENDING', 'SENT'].includes(displayStatus(record))).length)
const activatedCount = computed(() => records.value.filter(record => normalizedStatus(record.status) === 'ACTIVATED').length)
const detailRecord = computed(() => records.value.find(record => record.id === detailId.value) || null)
const resendRecord = computed(() => records.value.find(record => record.id === resendId.value) || null)
const revokeRecord = computed(() => records.value.find(record => record.id === revokeId.value) || null)

function normalizedStatus(status: string): InviteStatus {
  const normalized = String(status || '').toUpperCase()
  return normalized === 'PENDING' ? 'PENDING_SEND' : normalized
}

function displayStatus(record: PlatformAccountInvitationItem): InviteStatus {
  return sendingIds.value.has(record.id) ? 'SENDING' : normalizedStatus(record.status)
}

function normalizedSource(source: string) {
  return String(source || 'MANUAL').toUpperCase()
}

function statusOf(record: PlatformAccountInvitationItem) {
  const status = displayStatus(record)
  return statusConfig[status] || statusConfig.SENT
}

function statusLabel(record: PlatformAccountInvitationItem) {
  return statusConfig[displayStatus(record)]?.label || '待发送'
}

function sourceLabel(source: string) {
  return normalizedSource(source) === 'BATCH' ? '批量导入' : '单次邀请'
}

function isBatchRecord(record: PlatformAccountInvitationItem) {
  return normalizedSource(record.source) === 'BATCH'
}

function roleLabel(roleCode: string) {
  return String(roleCode).toUpperCase() === 'SUPER_ADMIN' ? '管理员' : '普通用户'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function canResend(record: PlatformAccountInvitationItem) {
  if (isBatchRecord(record)) return false
  const normalized = normalizedStatus(displayStatus(record))
  return normalized === 'FAILED' || normalized === 'EXPIRED'
}

function canRevoke(record: PlatformAccountInvitationItem) {
  if (isBatchRecord(record)) return false
  const normalized = normalizedStatus(displayStatus(record))
  return normalized === 'PENDING_SEND' || normalized === 'SENT'
}

function setSending(id: number, sending: boolean) {
  const next = new Set(sendingIds.value)
  if (sending) next.add(id)
  else next.delete(id)
  sendingIds.value = next
}

async function loadRecords() {
  loading.value = true
  errorMessage.value = ''
  try {
    records.value = await platformAdminApi.getAccountInvitations()
    emit('stats', records.value.length, failedCount.value)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function resend(record: PlatformAccountInvitationItem) {
  actionId.value = record.id
  setSending(record.id, true)
  resendId.value = null
  try {
    const result = await platformAdminApi.resendAccountInvitation(record.id)
    if (normalizedStatus(result.status) === 'FAILED') {
      ElMessage.error(result.failReason || '邀请邮件发送失败，请检查 SMTP 配置后重试')
    } else {
      ElMessage.success('邀请邮件已重新发送')
    }
    await loadRecords()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    setSending(record.id, false)
    actionId.value = null
  }
}

async function revoke(record: PlatformAccountInvitationItem) {
  actionId.value = record.id
  revokeId.value = null
  try {
    await platformAdminApi.revokeAccountInvitation(record.id)
    ElMessage.success('邀请已撤销')
    await loadRecords()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    actionId.value = null
  }
}

onMounted(() => { void loadRecords() })
</script>

<template>
  <section class="platform-invite-records" aria-label="成员记录">
    <div class="platform-invite-records__summary">
      <div v-for="item in [
        { label: '发送失败', value: failedCount, color: '#f53f3f', bg: '#fff0f0' },
        { label: '待激活', value: pendingCount, color: '#ff7d00', bg: '#fff5eb' },
        { label: '已激活', value: activatedCount, color: '#00b42a', bg: '#e8ffea' },
        { label: '全部记录', value: records.length, color: '#4e5969', bg: '#f2f3f5' },
      ]" :key="item.label" class="platform-invite-records__summary-item" :style="{ color: item.color, background: item.bg }">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </div>

    <div class="platform-invite-records__toolbar">
      <label class="platform-invite-records__search">
        <Search :size="13" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="搜索姓名或邮箱…" aria-label="搜索姓名或邮箱" />
      </label>
      <div class="platform-invite-records__source-filter" role="group" aria-label="成员来源筛选">
        <button v-for="item in [
          { value: 'ALL', label: '全部来源' },
          { value: 'MANUAL', label: '单次邀请' },
          { value: 'BATCH', label: '批量导入' },
        ]" :key="item.value" type="button" :class="{ 'is-selected': sourceFilter === item.value }" @click="sourceFilter = item.value as SourceFilter">
          {{ item.label }}
        </button>
      </div>
      <div class="platform-invite-records__status-filter" role="group" aria-label="成员状态筛选">
        <button v-for="item in [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_SEND', label: '待发送' },
          { value: 'SENDING', label: '发送中' },
          { value: 'FAILED', label: '发送失败' },
          { value: 'SENT', label: '待激活' },
          { value: 'ACTIVATED', label: '已激活' },
          { value: 'EXPIRED', label: '已过期' },
          { value: 'REVOKED', label: '已撤销' },
        ]" :key="item.value" type="button" :class="{ 'is-selected': statusFilter === item.value, [`is-${item.value.toLowerCase()}`]: statusFilter === item.value && item.value !== 'ALL' }" @click="statusFilter = item.value as StatusFilter">
          {{ item.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="platform-invite-records__state">
      <div class="platform-invite-records__spinner" />
      <span>正在加载成员记录</span>
    </div>
    <div v-else-if="errorMessage" class="platform-invite-records__state" role="alert">
      <AlertTriangle :size="22" />
      <strong>成员记录加载失败</strong>
      <span>{{ errorMessage }}</span>
      <button type="button" @click="loadRecords">重新加载</button>
    </div>
    <div v-else class="platform-invite-records__table-wrap">
      <div class="platform-invite-records__table-head">
        <span class="w-person">成员</span><span class="w-email">邮箱</span><span class="w-role">角色</span><span class="w-source">加入方式</span><span class="w-time">加入时间</span><span class="w-time">过期时间</span><span class="w-status">状态</span><span class="w-reason">失败原因</span><span class="w-operator">操作人</span><span class="w-actions">操作</span>
      </div>
      <div v-for="record in filteredRecords" :key="record.id" class="platform-invite-records__row" :class="{ 'is-failed': displayStatus(record) === 'FAILED' }">
        <div class="w-person platform-invite-records__person"><span class="platform-invite-records__avatar">{{ record.displayName.slice(0, 1) || '用' }}</span><span>{{ record.displayName }}</span></div>
        <span class="w-email muted ellipsis">{{ record.email }}</span>
        <span class="w-role"><b class="platform-invite-records__badge" :class="String(record.roleCode).toUpperCase() === 'SUPER_ADMIN' ? 'is-admin' : ''">{{ roleLabel(record.roleCode) }}</b></span>
         <span class="w-source"><b class="platform-invite-records__badge is-source">{{ sourceLabel(record.source) }}</b></span>
        <span class="w-time muted mono">{{ formatDate(record.invitedAt) }}</span>
        <span class="w-time muted mono">{{ formatDate(record.expiresAt) }}</span>
        <span class="w-status"><b class="platform-invite-records__status" :style="{ color: statusOf(record).color, background: statusOf(record).bg }"><i v-if="displayStatus(record) === 'SENDING'" class="platform-invite-records__status-dot" aria-hidden="true" />{{ statusLabel(record) }}</b></span>
        <span class="w-reason ellipsis" :class="record.failReason ? 'has-reason' : 'muted'" :title="record.failReason || ''">{{ record.failReason || '—' }}</span>
        <span class="w-operator">{{ record.operatorName || '系统' }}</span>
        <span class="w-actions platform-invite-records__actions">
          <button type="button" @click="detailId = record.id">查看</button>
          <button v-if="canResend(record)" type="button" class="is-warning" :disabled="actionId === record.id" @click="resendId = record.id">重发</button>
          <button v-if="canRevoke(record)" type="button" class="is-danger" :disabled="actionId === record.id" @click="revokeId = record.id">撤销</button>
        </span>
      </div>
      <div v-if="filteredRecords.length === 0" class="platform-invite-records__empty">暂无匹配的成员记录</div>
    </div>

    <div v-if="detailRecord" class="platform-invite-records__overlay" @click.self="detailId = null">
      <aside class="platform-invite-records__drawer" role="dialog" aria-modal="true" aria-label="成员记录详情">
        <header><div><strong>成员记录详情</strong><small>{{ detailRecord.email }}</small></div><button type="button" aria-label="关闭" @click="detailId = null"><X :size="16" /></button></header>
        <div class="platform-invite-records__drawer-body">
          <div v-for="item in [
            ['被邀请人', detailRecord.displayName], ['邮箱地址', detailRecord.email], ['平台角色', roleLabel(detailRecord.roleCode)],
            [isBatchRecord(detailRecord) ? '导入时间' : '邀请时间', formatDate(detailRecord.invitedAt)], ['过期时间', formatDate(detailRecord.expiresAt)], ['操作人', detailRecord.operatorName || '系统'],
          ]" :key="item[0]" class="platform-invite-records__detail-row"><span>{{ item[0] }}</span><b>{{ item[1] }}</b></div>
          <div class="platform-invite-records__detail-row"><span>成员状态</span><b class="platform-invite-records__status" :style="{ color: statusOf(detailRecord).color, background: statusOf(detailRecord).bg }">{{ statusLabel(detailRecord) }}</b></div>
          <div v-if="detailRecord.failReason" class="platform-invite-records__failure"><strong>失败原因</strong><span>{{ detailRecord.failReason }}</span></div>
        </div>
        <footer>
          <button v-if="canResend(detailRecord)" type="button" class="is-warning-solid" @click="resendId = detailRecord.id; detailId = null"><Send :size="12" />重新发送</button>
          <button v-if="canRevoke(detailRecord)" type="button" class="is-danger-outline" @click="revokeId = detailRecord.id; detailId = null">撤销邀请</button>
          <button type="button" class="is-neutral" @click="detailId = null">关闭</button>
        </footer>
      </aside>
    </div>

    <div v-if="resendRecord" class="platform-invite-records__confirm-overlay" @click.self="resendId = null">
      <section class="platform-invite-records__confirm" role="dialog" aria-modal="true" aria-label="重新发送邀请">
        <div class="platform-invite-records__confirm-title"><span class="is-warning-icon"><Send :size="16" /></span><div><strong>重新发送邀请</strong><small>{{ resendRecord.email }}</small></div></div>
        <p>旧的邀请链接将立即失效，系统将向 <b>{{ resendRecord.email }}</b> 发送新的激活链接，有效期 48 小时。</p>
        <div class="platform-invite-records__confirm-actions"><button type="button" class="is-neutral" @click="resendId = null">取消</button><button type="button" class="is-warning-solid" :disabled="actionId === resendRecord.id" @click="resend(resendRecord)">{{ actionId === resendRecord.id ? '发送中…' : '确认重发' }}</button></div>
      </section>
    </div>

    <div v-if="revokeRecord" class="platform-invite-records__confirm-overlay" @click.self="revokeId = null">
      <section class="platform-invite-records__confirm" role="dialog" aria-modal="true" aria-label="撤销邀请">
        <div class="platform-invite-records__confirm-title"><span class="is-danger-icon"><X :size="16" /></span><div><strong>撤销邀请</strong><small>{{ revokeRecord.displayName }} · {{ revokeRecord.email }}</small></div></div>
        <p>撤销后，该邀请链接将立即失效，<b>{{ revokeRecord.displayName }}</b> 将无法通过该链接激活账号。如需重新邀请，可在记录中再次发送。</p>
        <div class="platform-invite-records__confirm-actions"><button type="button" class="is-neutral" @click="revokeId = null">取消</button><button type="button" class="is-danger-solid" :disabled="actionId === revokeRecord.id" @click="revoke(revokeRecord)">{{ actionId === revokeRecord.id ? '撤销中…' : '确认撤销' }}</button></div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.platform-invite-records { width:100%; color:#1d2129; }
.platform-invite-records__summary { display:flex; gap:10px; padding:14px 20px; border-bottom:1px solid #e5e6eb; background:#f4f6fa; }
.platform-invite-records__summary-item { display:flex; align-items:center; gap:6px; padding:6px 12px; border:1px solid currentColor; border-color:color-mix(in srgb,currentColor 12%,transparent); border-radius:8px; }
.platform-invite-records__summary-item strong { font-size:18px; font-weight:700; line-height:1; }
.platform-invite-records__summary-item span { font-size:11px; line-height:16.5px; }
.platform-invite-records__toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:12px 20px; border-bottom:1px solid #e5e6eb; }
.platform-invite-records__search { position:relative; width:220px; height:32px; flex:0 0 220px; }
.platform-invite-records__search svg { position:absolute; top:9px; left:10px; color:#c9cdd4; }
.platform-invite-records__search input { width:100%; height:32px; padding:0 10px 0 30px; border:1px solid #e5e6eb; border-radius:8px; outline:none; color:#1d2129; font-size:12px; }
.platform-invite-records__search input:focus { border-color:#db2777; }
.platform-invite-records__source-filter { display:flex; overflow:hidden; border:1px solid #e5e6eb; border-radius:8px; }
.platform-invite-records__source-filter button { height:32px; padding:0 12px; border:0; border-right:1px solid #e5e6eb; background:transparent; color:#4e5969; cursor:pointer; font-size:12px; }
.platform-invite-records__source-filter button:last-child { border-right:0; }
.platform-invite-records__source-filter button.is-selected { background:#fdf2f8; color:#db2777; font-weight:600; }
.platform-invite-records__status-filter { display:flex; flex-wrap:wrap; gap:4px; }
.platform-invite-records__status-filter button { height:32px; padding:0 12px; border:1px solid #e5e6eb; border-radius:8px; background:transparent; color:#4e5969; cursor:pointer; font-size:12px; }
.platform-invite-records__status-filter button.is-selected { border-color:#db2777; background:#fdf2f8; color:#db2777; font-weight:600; }
.platform-invite-records__status-filter button.is-selected.is-failed { border-color:#f53f3f; background:#fff0f0; color:#f53f3f; }
.platform-invite-records__status-filter button.is-selected.is-sent { border-color:#ff7d00; background:#fff5eb; color:#ff7d00; }
.platform-invite-records__status-filter button.is-selected.is-activated { border-color:#00b42a; background:#e8ffea; color:#00b42a; }
.platform-invite-records__status-filter button.is-selected.is-expired { border-color:#c9cdd4; background:#f2f3f5; color:#c9cdd4; }
.platform-invite-records__status-filter button.is-selected.is-revoked { border-color:#86909c; background:#f2f3f5; color:#86909c; }
.platform-invite-records__table-wrap { min-width:1120px; overflow:auto; }
.platform-invite-records__table-head,.platform-invite-records__row { display:flex; align-items:center; min-width:1120px; gap:0; padding:10px 20px; }
.platform-invite-records__table-head { background:#f4f6fa; color:#86909c; font-size:11px; font-weight:600; letter-spacing:.05em; line-height:16.5px; text-transform:uppercase; }
.platform-invite-records__row { min-height:57px; padding-top:13px; padding-bottom:13px; border-top:1px solid #e5e6eb; background:#fff; transition:background-color 100ms ease; font-size:12px; }
.platform-invite-records__row:hover { background:#fafbfe; }
.platform-invite-records__row.is-failed { background:#fffafa; }
.platform-invite-records__row.is-failed:hover { background:#fff5f5; }
.w-person { width:152px; flex:0 0 152px; }.w-email { width:192px; flex:0 0 192px; }.w-role { width:72px; flex:0 0 72px; }.w-source { width:80px; flex:0 0 80px; }.w-time { width:126px; flex:0 0 126px; }.w-status { width:80px; flex:0 0 80px; }.w-reason { min-width:160px; flex:1 1 auto; padding-right:8px; }.w-operator { width:64px; flex:0 0 64px; }.w-actions { width:140px; flex:0 0 140px; }
.platform-invite-records__person { display:flex; min-width:0; align-items:center; gap:8px; font-size:13px; font-weight:500; }.platform-invite-records__person > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.platform-invite-records__avatar { display:inline-flex; width:28px; height:28px; flex:0 0 28px; align-items:center; justify-content:center; border-radius:50%; background:linear-gradient(135deg,#db2777,#db277799); color:#fff; font-size:12px; font-weight:700; }
.platform-invite-records .muted { overflow:hidden; color:#86909c; text-overflow:ellipsis; white-space:nowrap; }.platform-invite-records .mono { font-family:var(--app-font-family-mono); font-size:11px; }.ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.has-reason { overflow:hidden; color:#f53f3f; text-overflow:ellipsis; white-space:nowrap; }
.platform-invite-records__badge,.platform-invite-records__status { display:inline-flex; align-items:center; padding:2px 7px; border-radius:10px; font-size:10px; font-weight:600; line-height:16px; white-space:nowrap; }.platform-invite-records__badge { background:#f2f3f5; color:#86909c; }.platform-invite-records__badge.is-admin { background:#fdf2f8; color:#db2777; }.platform-invite-records__actions { display:flex; gap:5px; }.platform-invite-records__actions button { height:30px; padding:0 13px; border:1px solid #e5e6eb; border-radius:7px; background:#fff; color:#165dff; cursor:pointer; font-size:12px; }.platform-invite-records__actions button:hover { background:#ebf3ff; }.platform-invite-records__actions button.is-warning { border-color:#ff7d0040; background:#fff5eb; color:#ff7d00; }.platform-invite-records__actions button.is-danger { border-color:#f53f3f40; background:#fff0f0; color:#f53f3f; }.platform-invite-records__actions button:disabled { cursor:not-allowed; opacity:.55; }
.platform-invite-records__state,.platform-invite-records__empty { display:flex; min-height:240px; align-items:center; justify-content:center; flex-direction:column; gap:8px; color:#86909c; font-size:12px; }.platform-invite-records__state strong { color:#1d2129; font-size:14px; }.platform-invite-records__state button { height:30px; padding:0 12px; border:1px solid #db2777; border-radius:7px; background:#fdf2f8; color:#db2777; cursor:pointer; font-size:12px; }.platform-invite-records__spinner { width:22px; height:22px; border:2px solid #db2777; border-right-color:transparent; border-radius:50%; animation:platform-invite-spin 700ms linear infinite; }
.platform-invite-records__overlay,.platform-invite-records__confirm-overlay { position:fixed; z-index:300; inset:0; }.platform-invite-records__overlay { background:rgba(0,0,0,.35); }.platform-invite-records__drawer { position:absolute; top:0; right:0; bottom:0; display:flex; width:420px; flex-direction:column; background:#fff; box-shadow:-4px 0 24px rgba(0,0,0,.12); }.platform-invite-records__drawer header { display:flex; align-items:center; gap:10px; padding:18px 20px; border-bottom:1px solid #e5e6eb; }.platform-invite-records__drawer header > div { display:flex; min-width:0; flex:1; flex-direction:column; }.platform-invite-records__drawer header strong { font-size:15px; font-weight:600; }.platform-invite-records__drawer header small { margin-top:2px; overflow:hidden; color:#86909c; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }.platform-invite-records__drawer header button { display:flex; padding:4px; border:0; background:none; color:#86909c; cursor:pointer; }.platform-invite-records__drawer-body { flex:1; overflow-y:auto; padding:20px; }.platform-invite-records__detail-row { display:flex; align-items:flex-start; padding:12px 0; border-bottom:1px solid #e5e6eb; font-size:13px; }.platform-invite-records__detail-row > span { width:80px; flex:0 0 80px; color:#86909c; font-size:12px; }.platform-invite-records__detail-row b { color:#1d2129; font-weight:500; word-break:break-all; }.platform-invite-records__failure { display:flex; margin-top:16px; padding:12px 14px; flex-direction:column; gap:6px; border:1px solid #f53f3f25; border-radius:9px; background:#fff0f0; color:#f53f3f; font-size:12px; line-height:1.6; }.platform-invite-records__failure strong { font-size:11px; }.platform-invite-records__drawer footer { display:flex; flex-shrink:0; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid #e5e6eb; }.platform-invite-records button.is-neutral,.platform-invite-records button.is-warning-solid,.platform-invite-records button.is-danger-solid,.platform-invite-records button.is-danger-outline { height:32px; padding:0 16px; border-radius:8px; cursor:pointer; font-size:12px; }.platform-invite-records button.is-neutral { border:1px solid #e5e6eb; background:#fff; color:#4e5969; }.platform-invite-records button.is-warning-solid { display:inline-flex; align-items:center; gap:5px; border:0; background:#ff7d00; color:#fff; font-weight:600; }.platform-invite-records button.is-danger-outline { border:1px solid #f53f3f40; background:#f53f3f0d; color:#f53f3f; }.platform-invite-records button.is-danger-solid { border:0; background:#f53f3f; color:#fff; font-weight:600; }.platform-invite-records button:disabled { cursor:not-allowed; opacity:.6; }
.platform-invite-records__confirm-overlay { display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.4); }.platform-invite-records__confirm { width:400px; padding:24px; border-radius:16px; background:#fff; box-shadow:0 20px 60px rgba(0,0,0,.2); }.platform-invite-records__confirm-title { display:flex; align-items:center; gap:10px; margin-bottom:12px; }.platform-invite-records__confirm-title > div { display:flex; min-width:0; flex-direction:column; }.platform-invite-records__confirm-title strong { font-size:15px; font-weight:600; }.platform-invite-records__confirm-title small { margin-top:2px; overflow:hidden; color:#86909c; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }.platform-invite-records__confirm-title > span { display:flex; width:36px; height:36px; flex:0 0 36px; align-items:center; justify-content:center; border-radius:10px; }.is-warning-icon { background:#fff5eb; color:#ff7d00; }.is-danger-icon { background:#f53f3f12; color:#f53f3f; }.platform-invite-records__confirm p { margin:0 0 16px; color:#4e5969; font-size:13px; line-height:1.6; }.platform-invite-records__confirm p b { color:#1d2129; }.platform-invite-records__confirm-actions { display:flex; gap:10px; }.platform-invite-records__confirm-actions button { flex:1; }.platform-invite-records__confirm-actions button:last-child { flex:2; }
.platform-invite-records__source-filter { gap:3px; }
.platform-invite-records__search svg { top:10px; }
.platform-invite-records__row { line-height:18px; }
.platform-invite-records .w-reason { font-size:11px; line-height:16.5px; }
.platform-invite-records__status { padding:2px 8px; font-size:11px; font-weight:500; line-height:17px; }
.platform-invite-records__status-dot { width:6px; height:6px; flex:0 0 6px; border-radius:50%; background:#165dff; }
.platform-invite-records__actions button { padding:0 12px; border-color:#165dff40; background:#165dff15; font-weight:500; line-height:18px; transition:all .12s; }
.platform-invite-records__actions button:hover { background:#165dff25; }
.platform-invite-records__actions button.is-warning { border-color:#ff7d0040; background:#ff7d0015; }
.platform-invite-records__actions button.is-warning:hover { background:#ff7d0025; }
.platform-invite-records__actions button.is-danger { border-color:#f53f3f40; background:#f53f3f15; }
.platform-invite-records__actions button.is-danger:hover { background:#f53f3f25; }
.platform-invite-records__state { line-height:18px; }
.platform-invite-records__empty { min-height:0; padding:56px 0; color:#c9cdd4; font-size:13px; line-height:19.5px; }
.platform-invite-records__drawer header strong { line-height:22.5px; }
.platform-invite-records__drawer header small { line-height:16.5px; }
.platform-invite-records__detail-row { line-height:19.5px; }
.platform-invite-records__detail-row > span { line-height:18px; }
.platform-invite-records__detail-row b { line-height:19.5px; }
.platform-invite-records__drawer .platform-invite-records__status { font-size:12px; line-height:18px; }
.platform-invite-records button.is-neutral,.platform-invite-records button.is-warning-solid,.platform-invite-records button.is-danger-solid,.platform-invite-records button.is-danger-outline { height:36px; font-size:13px; line-height:19.5px; }
.platform-invite-records__drawer footer button.is-neutral,.platform-invite-records__drawer footer button.is-warning-solid,.platform-invite-records__drawer footer button.is-danger-solid,.platform-invite-records__drawer footer button.is-danger-outline { height:32px; font-size:12px; line-height:18px; }
.platform-invite-records__confirm-actions button { height:36px; font-size:13px; line-height:19.5px; }
.platform-invite-records__confirm { min-height:217px; box-sizing:border-box; }
.platform-invite-records__confirm-title strong { line-height:22.5px; }
.platform-invite-records__confirm-title small { line-height:16.5px; }
.platform-invite-records__confirm p { line-height:20.8px; }
@keyframes platform-invite-spin { to { transform:rotate(360deg); } }
@media (max-width:900px) { .platform-invite-records__drawer { width:min(420px,100vw); }.platform-invite-records__toolbar { align-items:flex-start; }.platform-invite-records__status-filter { width:100%; } }
</style>
