export type RequirementPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type RequirementStatus = 'uncovered' | 'partial' | 'covered' | 'passed'
export type RequirementSource = 'manual' | 'jira' | 'tapd' | 'excel'
export type ReviewStatus = 'pending' | 'reviewing' | 'passed' | 'rejected'
export type ExecutionStatus = 'pending' | 'passed' | 'failed' | 'blocked' | 'skipped'
export type DefectSeverity = 'critical' | 'major' | 'minor' | 'trivial'
export type DefectStatus = 'open' | 'fixing' | 'fixed' | 'closed' | 'rejected'

export interface LinkedRequirementCase {
  id: string
  no: string
  title: string
  status: ExecutionStatus
  assignee: string
  reviewStatus: ReviewStatus
  reviewNote?: string
}

export interface LinkedRequirementDefect {
  id: string
  no: string
  title: string
  severity: DefectSeverity
  status: DefectStatus
}

export interface ManagedRequirement {
  id: string
  title: string
  versionId: string
  priority: RequirementPriority
  status: RequirementStatus
  source: RequirementSource
  sourceRef?: string
  reviewStatus: ReviewStatus
  caseTotal: number
  caseCovered: number
  casePassed: number
  assignee: string
  description: string
  createdAt: string
  linkedCases: LinkedRequirementCase[]
  linkedDefects: LinkedRequirementDefect[]
}

export interface RequirementTestPlan {
  id: string
  versionId: string
  name: string
  status: 'in-progress' | 'completed'
}

export interface RequirementVersion {
  id: string
  name: string
  status: 'planning' | 'developing' | 'testing' | 'pending-release' | 'released'
}

export interface CaseDirectory {
  id: string
  label: string
  count: number
  children?: CaseDirectory[]
}

export interface LibraryCase {
  id: string
  no: string
  title: string
  directoryId: string
  module: string
  priority: RequirementPriority
}

export interface CaseDetail {
  precondition: string
  steps: Array<{ action: string; expected: string }>
}

export const requirementVersions: RequirementVersion[] = [
  { id: 'V1', name: 'v2.4.0', status: 'testing' },
  { id: 'V2', name: 'v2.3.5', status: 'pending-release' },
  { id: 'V3', name: 'v2.5.0', status: 'developing' },
  { id: 'V4', name: 'v2.3.0', status: 'released' },
]

export const requirementTestPlans: RequirementTestPlan[] = [
  { id: 'P1', versionId: 'V1', name: 'v2.4.0 全量回归测试', status: 'in-progress' },
  { id: 'P2', versionId: 'V1', name: 'v2.4.0 冒烟验证', status: 'completed' },
]

export const managedRequirementDemoData: ManagedRequirement[] = [
  {
    id: 'R1', title: '用户登录体验优化', versionId: 'V1', priority: 'P1', status: 'passed', source: 'jira', sourceRef: 'PROJ-240',
    reviewStatus: 'reviewing', caseTotal: 3, caseCovered: 3, casePassed: 2, assignee: '李明', createdAt: '2026-06-15',
    description: '优化登录页面体验，支持手机号+验证码快捷登录，增加账号安全检测提示，历史登录设备管理。',
    linkedCases: [
      { id: 'cl1', no: 'TC-001', title: '用户登录核心流程', status: 'passed', assignee: '李明', reviewStatus: 'passed' },
      { id: 'cl2', no: 'TC-002', title: '账号注册完整流程', status: 'passed', assignee: '王芳', reviewStatus: 'passed' },
      { id: 'cl3', no: 'TC-003', title: '密码找回验证码流程', status: 'failed', assignee: '李明', reviewStatus: 'rejected', reviewNote: '步骤 4 缺少验证码过期的异常场景，需补充后重新提交' },
    ],
    linkedDefects: [{ id: 'b1', no: 'BUG-142', title: '密码找回验证码有效期判断错误，已过期仍可使用', severity: 'major', status: 'fixing' }],
  },
  {
    id: 'R2', title: '订单批量操作功能', versionId: 'V1', priority: 'P0', status: 'partial', source: 'jira', sourceRef: 'PROJ-238',
    reviewStatus: 'reviewing', caseTotal: 4, caseCovered: 3, casePassed: 1, assignee: '陈伟', createdAt: '2026-06-15',
    description: '支持订单批量取消、批量导出，实现商品超卖保护逻辑，优化库存锁定与扣减机制。',
    linkedCases: [
      { id: 'cl7', no: 'TC-007', title: '订单创建-支付-完成闭环', status: 'passed', assignee: '陈伟', reviewStatus: 'passed' },
      { id: 'cl8', no: 'TC-008', title: '订单批量取消操作', status: 'blocked', assignee: '陈伟', reviewStatus: 'reviewing' },
      { id: 'cl9', no: 'TC-009', title: '商品超卖边界值验证', status: 'failed', assignee: '李明', reviewStatus: 'reviewing' },
    ],
    linkedDefects: [
      { id: 'b2', no: 'BUG-143', title: '商品超卖场景下库存扣减并发问题', severity: 'major', status: 'open' },
      { id: 'b3', no: 'BUG-138', title: '订单批量取消接口超时，前端无错误提示', severity: 'minor', status: 'fixing' },
    ],
  },
  {
    id: 'R3', title: '购物车跨店铺结算', versionId: 'V1', priority: 'P1', status: 'covered', source: 'manual',
    reviewStatus: 'passed', caseTotal: 2, caseCovered: 2, casePassed: 0, assignee: '王芳', createdAt: '2026-06-18',
    description: '支持跨店铺购物车合并结算，优惠券按店铺分组计算，运费合并策略。',
    linkedCases: [
      { id: 'cl10', no: 'TC-010', title: '优惠券叠加规则验证', status: 'passed', assignee: '王芳', reviewStatus: 'passed' },
      { id: 'cl12', no: 'TC-012', title: '购物车跨店铺结算', status: 'pending', assignee: '王芳', reviewStatus: 'passed' },
    ], linkedDefects: [],
  },
  {
    id: 'R4', title: '会员等级权益优化', versionId: 'V1', priority: 'P2', status: 'partial', source: 'tapd', sourceRef: 'TAPD-1892',
    reviewStatus: 'pending', caseTotal: 2, caseCovered: 1, casePassed: 0, assignee: '李明', createdAt: '2026-06-20',
    description: '优化会员等级升降级逻辑，权益变更实时生效，增加降级原因通知。',
    linkedCases: [{ id: 'cl13', no: 'TC-013', title: '会员等级升降级逻辑', status: 'pending', assignee: '李明', reviewStatus: 'pending' }],
    linkedDefects: [{ id: 'b4', no: 'BUG-139', title: '会员等级降级后权益未即时刷新', severity: 'minor', status: 'fixed' }],
  },
  {
    id: 'R5', title: '验证码有效期安全修复', versionId: 'V2', priority: 'P0', status: 'passed', source: 'jira', sourceRef: 'BUG-142',
    reviewStatus: 'passed', caseTotal: 1, caseCovered: 1, casePassed: 1, assignee: '张程远', createdAt: '2026-06-20',
    description: '修复密码找回验证码有效期判断逻辑，确保已过期验证码无法使用。',
    linkedCases: [{ id: 'cl3', no: 'TC-003', title: '密码找回验证码流程', status: 'passed', assignee: '李明', reviewStatus: 'passed' }], linkedDefects: [],
  },
  {
    id: 'R6', title: '接口超时优化修复', versionId: 'V2', priority: 'P0', status: 'passed', source: 'jira', sourceRef: 'BUG-138',
    reviewStatus: 'passed', caseTotal: 1, caseCovered: 1, casePassed: 1, assignee: '王芳', createdAt: '2026-06-21',
    description: '优化订单批量操作接口性能，增加前端超时提示，完善异常重试机制。',
    linkedCases: [{ id: 'cl8', no: 'TC-008', title: '订单批量取消操作', status: 'passed', assignee: '陈伟', reviewStatus: 'passed' }], linkedDefects: [],
  },
  {
    id: 'R7', title: '风控中心2.0引擎重构', versionId: 'V3', priority: 'P0', status: 'uncovered', source: 'manual',
    reviewStatus: 'pending', caseTotal: 0, caseCovered: 0, casePassed: 0, assignee: '陈伟', createdAt: '2026-07-08',
    description: '重构风控规则引擎，支持动态规则配置，引入机器学习风险评分。', linkedCases: [], linkedDefects: [],
  },
  {
    id: 'R8', title: '任务调度引擎重构', versionId: 'V3', priority: 'P1', status: 'uncovered', source: 'manual',
    reviewStatus: 'pending', caseTotal: 0, caseCovered: 0, casePassed: 0, assignee: '陈伟', createdAt: '2026-07-08',
    description: '重构任务调度系统，支持 DAG 任务依赖关系、分布式锁优化与执行历史持久化。', linkedCases: [], linkedDefects: [],
  },
  {
    id: 'R9', title: '活动运营平台升级', versionId: 'V3', priority: 'P1', status: 'uncovered', source: 'tapd', sourceRef: 'TAPD-2055',
    reviewStatus: 'pending', caseTotal: 0, caseCovered: 0, casePassed: 0, assignee: '王芳', createdAt: '2026-07-09',
    description: '活动报名支持多规格 SKU 选择，活动数据大盘实时更新。', linkedCases: [], linkedDefects: [],
  },
]

export const caseDirectoryTree: CaseDirectory[] = [{
  id: 'root', label: 'X-MAN', count: 18, children: [
    { id: 'user', label: '用户中心', count: 7, children: [
      { id: 'user-account', label: '账号管理', count: 4 },
      { id: 'user-security', label: '安全设置', count: 2 },
      { id: 'user-member', label: '会员管理', count: 1 },
    ] },
    { id: 'order', label: '订单中心管理端', count: 7, children: [
      { id: 'order-core', label: '订单核心', count: 3 },
      { id: 'order-promo', label: '营销计算', count: 1 },
      { id: 'order-return', label: '售后流程', count: 3 },
    ] },
    { id: 'growth', label: '获客中心', count: 3, children: [
      { id: 'growth-search', label: '搜索推荐', count: 2 },
      { id: 'growth-event', label: '活动运营', count: 1 },
    ] },
    { id: 'risk', label: '风控中心', count: 2, children: [
      { id: 'risk-rule', label: '规则引擎', count: 1 },
      { id: 'risk-block', label: '黑名单管理', count: 1 },
    ] },
  ],
}]

export const caseLibrary: LibraryCase[] = [
  ['cl1', 'TC-001', '用户登录核心流程', 'user-account', '用户中心', 'P0'],
  ['cl2', 'TC-002', '账号注册完整流程', 'user-account', '用户中心', 'P1'],
  ['cl3', 'TC-003', '密码找回验证码流程', 'user-account', '用户中心', 'P1'],
  ['cl4', 'TC-004', '账号封禁后登录提示', 'user-account', '用户中心', 'P2'],
  ['cl5', 'TC-005', '三方账号绑定解绑', 'user-security', '用户中心', 'P2'],
  ['cl6', 'TC-006', '账号安全设置完整流程', 'user-security', '用户中心', 'P2'],
  ['cl7', 'TC-007', '订单创建-支付-完成闭环', 'order-core', '订单中心', 'P0'],
  ['cl8', 'TC-008', '订单批量取消操作', 'order-core', '订单中心', 'P1'],
  ['cl9', 'TC-009', '商品超卖边界值验证', 'order-core', '订单中心', 'P1'],
  ['cl10', 'TC-010', '优惠券叠加规则验证', 'order-promo', '订单中心', 'P2'],
  ['cl11', 'TC-011', '退款流程全流程验证', 'order-return', '订单中心', 'P1'],
  ['cl12', 'TC-012', '购物车跨店铺结算', 'order-return', '订单中心', 'P1'],
  ['cl13', 'TC-013', '会员等级升降级逻辑', 'user-member', '用户中心', 'P2'],
  ['cl14', 'TC-014', '商品搜索过滤条件', 'growth-search', '获客中心', 'P2'],
  ['cl15', 'TC-015', '首页推荐位展示逻辑', 'growth-search', '获客中心', 'P2'],
  ['cl16', 'TC-016', '活动报名全流程', 'growth-event', '获客中心', 'P1'],
  ['cl17', 'TC-017', '风控规则命中场景', 'risk-rule', '风控中心', 'P0'],
  ['cl18', 'TC-018', '黑名单拦截验证', 'risk-block', '风控中心', 'P1'],
].map(([id, no, title, directoryId, module, priority]) => ({ id, no, title, directoryId, module, priority } as LibraryCase))

export const caseDetails: Record<string, CaseDetail> = {
  'TC-001': {
    precondition: '用户已完成注册，当前处于未登录状态，网络环境正常',
    steps: [
      { action: '打开登录页面，选择「手机号 + 密码」登录方式', expected: '页面正常加载，输入框可交互，无报错' },
      { action: '输入已注册的正确手机号', expected: '手机号格式验证通过，不显示错误提示' },
      { action: '输入正确密码，点击「登录」按钮', expected: '按钮出现加载态，3s 内跳转至首页' },
      { action: '观察首页右上角用户信息区域', expected: '显示用户头像与昵称，确认登录态生效' },
      { action: '刷新页面后再次检查登录态', expected: '登录状态保持，不重复弹出登录框' },
    ],
  },
  'TC-002': {
    precondition: '手机号未注册过账号，短信验证码服务正常',
    steps: [
      { action: '点击登录页「立即注册」链接', expected: '跳转至注册页，展示手机号输入框' },
      { action: '输入未注册的手机号，点击「获取验证码」', expected: '60s 倒计时启动，短信正常下发' },
      { action: '输入正确的 6 位验证码', expected: '验证码验证通过，进入填写昵称步骤' },
      { action: '填写昵称并设置密码，点击「完成注册」', expected: '注册成功提示，自动登录并跳转首页' },
    ],
  },
  'TC-003': {
    precondition: '用户已有注册账号，可正常接收短信',
    steps: [
      { action: '点击登录页「忘记密码」', expected: '进入找回密码页面' },
      { action: '输入已注册手机号，获取验证码', expected: '短信正常下发，60s 内有效' },
      { action: '输入验证码，进入重置密码步骤', expected: '验证码校验通过，展示新密码输入框' },
      { action: '输入新密码（满足复杂度要求）并确认', expected: '密码重置成功提示' },
      { action: '使用新密码登录', expected: '登录成功，旧密码不再可用' },
    ],
  },
}

export const getCaseDetail = (caseNo: string): CaseDetail => caseDetails[caseNo] || {
  precondition: '测试环境可用，相关基础数据已准备完成',
  steps: [
    { action: '进入对应功能页面并准备测试数据', expected: '页面和测试数据加载正常' },
    { action: '按业务流程完成核心操作', expected: '系统按预期完成处理并展示正确结果' },
    { action: '检查异常输入和边界条件', expected: '系统给出明确提示且数据保持一致' },
  ],
}
