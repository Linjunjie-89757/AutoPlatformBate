export type VersionType = 'iteration' | 'release' | 'patch' | 'hotfix'
export type VersionStatus = 'planning' | 'developing' | 'testing' | 'pending-release' | 'released' | 'archived'
export type RequirementStatus = 'uncovered' | 'partial' | 'covered' | 'passed'
export type BugStatus = 'open' | 'fixing' | 'fixed' | 'closed' | 'rejected'
export type VersionDetailTab = 'overview' | 'requirements' | 'plans' | 'bugs' | 'report' | 'logs'

export interface ManagedVersion {
  id: string
  no: string
  name: string
  type: VersionType
  status: VersionStatus
  owner: string
  startDate: string
  testDate: string
  releaseDate: string
  planCount: number
  scope: number
  executed: number
  passed: number
  p0Bugs: number
  p1Bugs: number
  goal: string
}

export interface VersionRequirement {
  id: string
  title: string
  sourceRef: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  source: 'Jira' | '手动' | '禅道'
  coveredCases: number
  totalCases: number
  status: RequirementStatus
  owner: string
}

export interface VersionPlan {
  id: string
  versionId: string
  name: string
  type: '回归测试' | '冒烟测试' | '发布验证'
  owner: string
  startDate: string
  endDate: string
  scope: number
  executed: number
  passed: number
  highBugs: number
  status: 'running' | 'completed' | 'pending'
  ownerConfirmRequired: boolean
  reportSigned: boolean
}

export interface VersionBug {
  no: string
  title: string
  severity: '严重' | '一般'
  priority: 'P0' | 'P1' | 'P2'
  status: BugStatus
  owner: string
  plan: string
  foundAt: string
}

export interface VersionLog {
  id: string
  actor: string
  action: string
  detail: string
  time: string
  type: 'create' | 'status' | 'edit'
}

export const versionStatusConfig: Record<VersionStatus, { label: string; color: string; background: string }> = {
  planning: { label: '规划中', color: '#86909c', background: '#f2f3f5' },
  developing: { label: '开发中', color: '#0ea5e9', background: '#e8f3ff' },
  testing: { label: '测试中', color: '#ff7d00', background: '#fff3e8' },
  'pending-release': { label: '待发布', color: '#7816ff', background: '#f5e8ff' },
  released: { label: '已发布', color: '#00b42a', background: '#e8ffea' },
  archived: { label: '已归档', color: '#86909c', background: '#f2f3f5' },
}

export const versionTypeConfig: Record<VersionType, string> = {
  iteration: '迭代版本',
  release: '正式版本',
  patch: '补丁版本',
  hotfix: '紧急修复',
}

export const managedVersionDemoData: ManagedVersion[] = [
  { id: 'V1', no: 'VER-001', name: 'v2.4.0', type: 'iteration', status: 'testing', owner: '李明', startDate: '2026-06-15', testDate: '2026-07-01', releaseDate: '2026-07-15', planCount: 2, scope: 80, executed: 62, passed: 58, p0Bugs: 0, p1Bugs: 2, goal: '完成用户中心重构和订单模块优化，覆盖全量回归' },
  { id: 'V2', no: 'VER-002', name: 'v2.3.5', type: 'patch', status: 'pending-release', owner: '王芳', startDate: '2026-06-20', testDate: '2026-06-28', releaseDate: '2026-07-08', planCount: 2, scope: 48, executed: 48, passed: 46, p0Bugs: 0, p1Bugs: 0, goal: '修复线上反馈的3个高优缺陷' },
  { id: 'V3', no: 'VER-003', name: 'v2.5.0', type: 'iteration', status: 'developing', owner: '陈伟', startDate: '2026-07-08', testDate: '2026-07-28', releaseDate: '2026-08-15', planCount: 0, scope: 0, executed: 0, passed: 0, p0Bugs: 0, p1Bugs: 0, goal: '引入风控中心 2.0 模块，重构任务调度引擎' },
  { id: 'V4', no: 'VER-004', name: 'v2.3.0', type: 'release', status: 'released', owner: '李明', startDate: '2026-05-20', testDate: '2026-06-01', releaseDate: '2026-06-20', planCount: 3, scope: 98, executed: 98, passed: 95, p0Bugs: 0, p1Bugs: 0, goal: '' },
  { id: 'V5', no: 'VER-005', name: 'v2.2.1', type: 'hotfix', status: 'archived', owner: '张程远', startDate: '2026-05-01', testDate: '2026-05-03', releaseDate: '2026-05-05', planCount: 1, scope: 12, executed: 12, passed: 12, p0Bugs: 0, p1Bugs: 0, goal: '' },
]

export const versionRequirements: VersionRequirement[] = [
  { id: 'R1', title: '用户登录体验优化', sourceRef: 'PROJ-240', priority: 'P1', source: 'Jira', coveredCases: 3, totalCases: 3, status: 'passed', owner: '李明' },
  { id: 'R2', title: '订单批量操作功能', sourceRef: 'PROJ-238', priority: 'P0', source: 'Jira', coveredCases: 3, totalCases: 4, status: 'partial', owner: '陈伟' },
  { id: 'R3', title: '购物车跨店铺结算', sourceRef: '', priority: 'P1', source: '手动', coveredCases: 2, totalCases: 2, status: 'covered', owner: '王芳' },
  { id: 'R4', title: '会员等级权益优化', sourceRef: 'TAPD-1892', priority: 'P2', source: '禅道', coveredCases: 1, totalCases: 2, status: 'partial', owner: '李明' },
]

export const versionPlans: VersionPlan[] = [
  { id: 'P1', versionId: 'V1', name: 'v2.4.0 全量回归测试', type: '回归测试', owner: '李明', startDate: '2026-07-01', endDate: '2026-07-12', scope: 80, executed: 62, passed: 58, highBugs: 2, status: 'running', ownerConfirmRequired: true, reportSigned: false },
  { id: 'P2', versionId: 'V1', name: 'v2.4.0 冒烟验证', type: '冒烟测试', owner: '陈伟', startDate: '2026-07-01', endDate: '2026-07-01', scope: 12, executed: 12, passed: 12, highBugs: 0, status: 'completed', ownerConfirmRequired: false, reportSigned: false },
  { id: 'P3', versionId: 'V2', name: 'v2.3.5 补丁回归', type: '回归测试', owner: '王芳', startDate: '2026-06-28', endDate: '2026-07-04', scope: 48, executed: 48, passed: 46, highBugs: 0, status: 'completed', ownerConfirmRequired: true, reportSigned: true },
  { id: 'P4', versionId: 'V2', name: 'v2.3.5 发布验证', type: '发布验证', owner: '张程远', startDate: '2026-07-08', endDate: '2026-07-08', scope: 20, executed: 0, passed: 0, highBugs: 0, status: 'pending', ownerConfirmRequired: false, reportSigned: false },
]

export const versionBugs: VersionBug[] = [
  { no: 'BUG-142', title: '密码找回验证码有效期判断错误，已过期仍可使用', severity: '严重', priority: 'P1', status: 'fixing', owner: '张程远', plan: 'v2.4.0 全量回归测试', foundAt: '07-07 11:05' },
  { no: 'BUG-143', title: '商品超卖场景下库存扣减并发问题', severity: '严重', priority: 'P1', status: 'open', owner: '陈伟', plan: 'v2.4.0 全量回归测试', foundAt: '07-06 16:10' },
  { no: 'BUG-138', title: '订单批量取消接口超时，前端无错误提示', severity: '一般', priority: 'P2', status: 'fixing', owner: '王芳', plan: 'v2.4.0 全量回归测试', foundAt: '07-07 09:45' },
  { no: 'BUG-139', title: '会员等级降级后权益未即时刷新', severity: '一般', priority: 'P2', status: 'fixed', owner: '张程远', plan: 'v2.4.0 全量回归测试', foundAt: '07-06 14:00' },
]

export const versionLogs: VersionLog[] = [
  { id: 'vl1', actor: '李明', action: '提交质量准出', detail: '已申请准出审核，等待确认', time: '07-07 18:00', type: 'status' },
  { id: 'vl2', actor: '系统', action: '计划状态变更', detail: '「v2.4.0 冒烟验证」→ 已完成', time: '07-01 17:00', type: 'status' },
  { id: 'vl3', actor: '陈伟', action: '关联测试计划', detail: '「v2.4.0 全量回归测试」已关联至本版本', time: '07-01 09:00', type: 'edit' },
  { id: 'vl4', actor: '王芳', action: '更新提测日期', detail: '计划提测 → 2026-07-01', time: '06-29 11:00', type: 'edit' },
  { id: 'vl5', actor: '系统', action: '版本状态变更', detail: '开发中 → 测试中', time: '06-30 09:00', type: 'status' },
  { id: 'vl6', actor: '陈伟', action: '创建版本', detail: '新建版本「v2.4.0」迭代版本', time: '06-15 10:00', type: 'create' },
]

export const requirementStatusConfig: Record<RequirementStatus, { label: string; color: string; background: string }> = {
  uncovered: { label: '未覆盖', color: '#86909c', background: '#f2f3f5' },
  partial: { label: '部分覆盖', color: '#ff7d00', background: '#fff3e8' },
  covered: { label: '已覆盖', color: '#0ea5e9', background: '#e0f5fe' },
  passed: { label: '测试通过', color: '#00b42a', background: '#e8ffea' },
}

export const bugStatusConfig: Record<BugStatus, { label: string; color: string; background: string }> = {
  open: { label: '待处理', color: '#f53f3f', background: '#ffe8e8' },
  fixing: { label: '处理中', color: '#ff7d00', background: '#fff3e8' },
  fixed: { label: '已修复', color: '#0ea5e9', background: '#e8f3ff' },
  closed: { label: '已关闭', color: '#00b42a', background: '#e8ffea' },
  rejected: { label: '已拒绝', color: '#86909c', background: '#f2f3f5' },
}
