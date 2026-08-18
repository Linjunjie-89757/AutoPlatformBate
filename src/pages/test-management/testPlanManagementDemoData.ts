export type TestPlanPurpose = 'version' | 'temp'
export type TestPlanType = 'smoke' | 'functional' | 'regression' | 'release' | 'mixed'
export type TestPlanStatus = 'draft' | 'pending' | 'running' | 'blocked' | 'completed' | 'cancelled'

export interface ManagedTestPlan {
  id: string
  no: string
  name: string
  purpose: TestPlanPurpose
  type: TestPlanType
  status: TestPlanStatus
  versionId: string | null
  versionName: string | null
  owner: string
  members: string[]
  startDate: string
  endDate: string
  scope: number
  executed: number
  passed: number
  failed: number
  blockedCases: number
  p0Bugs: number
  p1Bugs: number
  updatedAt: string
  goal: string
}

export type TestPlanCaseStatus = 'pending' | 'passed' | 'failed' | 'blocked' | 'skipped'
export type TestPlanBugStatus = 'open' | 'fixing' | 'fixed' | 'closed' | 'rejected'

export interface TestPlanCaseItem {
  id: string
  sourceCaseId?: string
  originType?: 'requirement' | 'manual' | 'direct'
  no: string
  title: string
  module: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  status: TestPlanCaseStatus
  assignee: string
  execTime: string
  notes: string
}

export interface TestPlanBugItem {
  id: string
  no: string
  title: string
  severity: 'critical' | 'major' | 'minor' | 'trivial'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  status: TestPlanBugStatus
  assignee: string
  linkedCase: string
  foundAt: string
}

export interface TestPlanLogItem {
  id: string
  actor: string
  action: string
  detail: string
  time: string
  type: 'create' | 'status' | 'edit' | 'mark' | 'comment' | 'system'
}

export const testPlanStatusConfig: Record<TestPlanStatus, { label: string; color: string; background: string }> = {
  draft: { label: '草稿', color: '#86909c', background: '#f2f3f5' },
  pending: { label: '待开始', color: '#0ea5e9', background: '#e8f3ff' },
  running: { label: '进行中', color: '#ff7d00', background: '#fff3e8' },
  blocked: { label: '已阻塞', color: '#f53f3f', background: '#ffe8e8' },
  completed: { label: '已完成', color: '#00b42a', background: '#e8ffea' },
  cancelled: { label: '已取消', color: '#86909c', background: '#f2f3f5' },
}

export const testPlanTypeConfig: Record<TestPlanType, { label: string; color: string }> = {
  smoke: { label: '冒烟测试', color: '#7816ff' },
  functional: { label: '功能测试', color: '#0ea5e9' },
  regression: { label: '回归测试', color: '#0ea5e9' },
  release: { label: '发布验证', color: '#ff7d00' },
  mixed: { label: '混合测试', color: '#4e5969' },
}

export const testPlanVersions = [
  { id: 'V1', name: 'v2.4.0', status: '测试中' },
  { id: 'V2', name: 'v2.3.5', status: '待发布' },
  { id: 'V3', name: 'v2.5.0', status: '开发中' },
  { id: 'V4', name: 'v2.3.0', status: '已发布' },
]

export const managedTestPlanDemoData: ManagedTestPlan[] = [
  { id: 'P1', no: 'TP-001', name: 'v2.4.0 全量回归测试', purpose: 'version', type: 'regression', status: 'running', versionId: 'V1', versionName: 'v2.4.0', owner: '李明', members: ['李明', '王芳', '陈伟'], startDate: '2026-07-01', endDate: '2026-07-12', scope: 80, executed: 62, passed: 58, failed: 4, blockedCases: 2, p0Bugs: 0, p1Bugs: 2, updatedAt: '2026-07-07 16:22', goal: '覆盖用户中心、订单中心全量功能回归' },
  { id: 'P2', no: 'TP-002', name: 'v2.4.0 冒烟验证', purpose: 'version', type: 'smoke', status: 'completed', versionId: 'V1', versionName: 'v2.4.0', owner: '陈伟', members: ['陈伟'], startDate: '2026-07-01', endDate: '2026-07-01', scope: 12, executed: 12, passed: 12, failed: 0, blockedCases: 0, p0Bugs: 0, p1Bugs: 0, updatedAt: '2026-07-01 17:00', goal: '提测冒烟验证通过' },
  { id: 'P3', no: 'TP-003', name: 'v2.3.5 补丁回归', purpose: 'version', type: 'regression', status: 'completed', versionId: 'V2', versionName: 'v2.3.5', owner: '王芳', members: ['王芳', '李明'], startDate: '2026-06-28', endDate: '2026-07-04', scope: 48, executed: 48, passed: 46, failed: 2, blockedCases: 0, p0Bugs: 0, p1Bugs: 0, updatedAt: '2026-07-04 18:00', goal: '验证高优缺陷修复正确性' },
  { id: 'P4', no: 'TP-004', name: 'v2.3.5 发布验证', purpose: 'version', type: 'release', status: 'pending', versionId: 'V2', versionName: 'v2.3.5', owner: '张程远', members: ['张程远', '李明'], startDate: '2026-07-08', endDate: '2026-07-08', scope: 20, executed: 0, passed: 0, failed: 0, blockedCases: 0, p0Bugs: 0, p1Bugs: 0, updatedAt: '2026-07-05 10:00', goal: '发布前核心路径验证' },
  { id: 'P5', no: 'TP-005', name: '风控规则引擎专项', purpose: 'temp', type: 'functional', status: 'running', versionId: null, versionName: null, owner: '陈伟', members: ['陈伟', '王芳'], startDate: '2026-07-03', endDate: '2026-07-09', scope: 28, executed: 18, passed: 15, failed: 3, blockedCases: 1, p0Bugs: 1, p1Bugs: 0, updatedAt: '2026-07-07 10:15', goal: '风控规则引擎核心逻辑专项验证' },
  { id: 'P6', no: 'TP-006', name: '订单中心全流程验证', purpose: 'temp', type: 'functional', status: 'draft', versionId: null, versionName: null, owner: '李明', members: ['李明'], startDate: '2026-07-10', endDate: '2026-07-14', scope: 0, executed: 0, passed: 0, failed: 0, blockedCases: 0, p0Bugs: 0, p1Bugs: 0, updatedAt: '2026-07-08 09:00', goal: '' },
]

export const testPlanCaseDemoData: TestPlanCaseItem[] = [
  { id: 'pc1', no: 'TC-001', title: '用户登录核心流程', module: '用户中心', priority: 'P0', status: 'passed', assignee: '李明', execTime: '07-07 10:20', notes: '' },
  { id: 'pc2', no: 'TC-002', title: '账号注册完整流程', module: '用户中心', priority: 'P1', status: 'passed', assignee: '王芳', execTime: '07-07 10:45', notes: '' },
  { id: 'pc3', no: 'TC-003', title: '密码找回验证码流程', module: '用户中心', priority: 'P1', status: 'failed', assignee: '李明', execTime: '07-07 11:00', notes: '验证码有效期判断有误，已过期仍可使用' },
  { id: 'pc4', no: 'TC-004', title: '账号封禁后登录提示', module: '用户中心', priority: 'P2', status: 'passed', assignee: '王芳', execTime: '07-06 14:30', notes: '' },
  { id: 'pc5', no: 'TC-005', title: '订单创建-支付-完成闭环', module: '订单中心', priority: 'P0', status: 'passed', assignee: '陈伟', execTime: '07-07 09:10', notes: '' },
  { id: 'pc6', no: 'TC-006', title: '订单批量取消操作', module: '订单中心', priority: 'P1', status: 'blocked', assignee: '陈伟', execTime: '07-07 09:40', notes: '接口超时，等待开发修复' },
  { id: 'pc7', no: 'TC-007', title: '商品超卖边界值验证', module: '订单中心', priority: 'P1', status: 'failed', assignee: '李明', execTime: '07-06 16:00', notes: '并发场景下库存扣减异常' },
  { id: 'pc8', no: 'TC-008', title: '优惠券叠加规则验证', module: '订单中心', priority: 'P2', status: 'passed', assignee: '王芳', execTime: '07-06 15:00', notes: '' },
  { id: 'pc9', no: 'TC-009', title: '会员等级升降级逻辑', module: '用户中心', priority: 'P2', status: 'pending', assignee: '李明', execTime: '—', notes: '' },
  { id: 'pc10', no: 'TC-010', title: '购物车跨店铺结算', module: '订单中心', priority: 'P1', status: 'pending', assignee: '王芳', execTime: '—', notes: '' },
  { id: 'pc11', no: 'TC-011', title: '退款流程全流程验证', module: '订单中心', priority: 'P1', status: 'pending', assignee: '陈伟', execTime: '—', notes: '' },
  { id: 'pc12', no: 'TC-012', title: '商品搜索过滤条件', module: '获客中心', priority: 'P2', status: 'pending', assignee: '—', execTime: '—', notes: '' },
]

export const testPlanBugDemoData: TestPlanBugItem[] = [
  { id: 'b1', no: 'BUG-142', title: '密码找回验证码有效期判断错误，已过期仍可使用', severity: 'major', priority: 'P1', status: 'fixing', assignee: '张程远', linkedCase: 'TC-003', foundAt: '07-07 11:05' },
  { id: 'b2', no: 'BUG-143', title: '商品超卖场景下库存扣减并发问题', severity: 'major', priority: 'P1', status: 'open', assignee: '陈伟', linkedCase: 'TC-007', foundAt: '07-06 16:10' },
  { id: 'b3', no: 'BUG-138', title: '订单批量取消接口超时，前端无错误提示', severity: 'minor', priority: 'P2', status: 'fixing', assignee: '王芳', linkedCase: 'TC-006', foundAt: '07-07 09:45' },
  { id: 'b4', no: 'BUG-139', title: '会员等级降级后权益未即时刷新', severity: 'minor', priority: 'P2', status: 'fixed', assignee: '张程远', linkedCase: 'TC-009', foundAt: '07-06 14:00' },
]

export const testPlanLogDemoData: TestPlanLogItem[] = [
  { id: 'l1', actor: '李明', action: '标记用例通过', detail: 'TC-001「用户登录核心流程」→ 通过', time: '07-07 10:20', type: 'mark' },
  { id: 'l2', actor: '李明', action: '标记用例失败', detail: 'TC-003「密码找回验证码流程」→ 失败，备注：验证码有效期判断有误', time: '07-07 11:00', type: 'mark' },
  { id: 'l3', actor: '陈伟', action: '标记用例阻塞', detail: 'TC-006「订单批量取消操作」→ 阻塞，等待开发修复', time: '07-07 09:40', type: 'mark' },
  { id: 'l4', actor: '王芳', action: '新建缺陷关联', detail: 'BUG-143 关联至 TC-007', time: '07-06 16:10', type: 'comment' },
  { id: 'l5', actor: '李明', action: '调整用例分配', detail: 'TC-009 分配给「李明」', time: '07-06 19:00', type: 'edit' },
  { id: 'l6', actor: '系统', action: '计划状态变更', detail: '草稿 → 进行中', time: '07-01 09:00', type: 'status' },
  { id: 'l7', actor: '李明', action: '创建测试计划', detail: '新建「v2.4.0 全量回归测试」', time: '06-28 17:00', type: 'create' },
]

export const testPlanExecutionTrend = [
  { date: '07/01', passed: 8, failed: 2 },
  { date: '07/02', passed: 12, failed: 3 },
  { date: '07/03', passed: 10, failed: 4 },
  { date: '07/04', passed: 15, failed: 2 },
  { date: '07/05', passed: 13, failed: 3 },
  { date: '07/06', passed: 18, failed: 1 },
  { date: '07/07', passed: 14, failed: 3 },
]
