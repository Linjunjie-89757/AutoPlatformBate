export type RequirementStatus = '评审中' | '开发中' | '测试中' | '已完成'
export type VersionStatus = '规划中' | '测试中' | '待发布' | '已发布'
export type PlanStatus = '未开始' | '进行中' | '已完成'

export interface RequirementItem {
  id: string
  title: string
  version: string
  owner: string
  status: RequirementStatus
  cases: number
  passed: number
  defects: number
  aiRecords: number
  updatedAt: string
  description: string
}

export interface VersionItem {
  id: string
  name: string
  status: VersionStatus
  owner: string
  releaseDate: string
  requirements: number
  plans: number
  progress: number
  openDefects: number
  risk: '低' | '中' | '高'
}

export interface TestPlanItem {
  id: string
  name: string
  version: string
  owner: string
  status: PlanStatus
  scope: string
  cases: number
  executed: number
  passed: number
  endDate: string
}

export const requirementDemoData: RequirementItem[] = [
  {
    id: 'REQ-2026-0815',
    title: '退款审核流程支持分级审批',
    version: 'v2.6.0',
    owner: '林俊杰',
    status: '测试中',
    cases: 36,
    passed: 28,
    defects: 3,
    aiRecords: 2,
    updatedAt: '今天 16:42',
    description: '高金额退款需要经过客服主管与财务双重审核，并完整保留审批轨迹。',
  },
  {
    id: 'REQ-2026-0809',
    title: '开户资料批量校验与错误定位',
    version: 'v2.6.0',
    owner: '陈晨',
    status: '开发中',
    cases: 24,
    passed: 0,
    defects: 0,
    aiRecords: 1,
    updatedAt: '今天 11:08',
    description: '批量导入开户资料后返回逐行校验结果，并支持快速定位错误字段。',
  },
  {
    id: 'REQ-2026-0726',
    title: '支付回调失败自动补偿',
    version: 'v2.5.2',
    owner: '王立',
    status: '已完成',
    cases: 42,
    passed: 42,
    defects: 5,
    aiRecords: 3,
    updatedAt: '08-12 18:20',
    description: '支付回调失败后按退避策略自动补偿，并提供人工重试和审计记录。',
  },
  {
    id: 'REQ-2026-0718',
    title: '账户风险等级动态调整',
    version: 'v2.6.0',
    owner: '周可',
    status: '评审中',
    cases: 0,
    passed: 0,
    defects: 0,
    aiRecords: 0,
    updatedAt: '08-11 09:35',
    description: '根据交易行为和风险事件动态调整客户风险等级，并触发对应控制策略。',
  },
  {
    id: 'REQ-2026-0702',
    title: '对账差异明细导出',
    version: 'v2.5.2',
    owner: '李敏',
    status: '测试中',
    cases: 18,
    passed: 13,
    defects: 2,
    aiRecords: 1,
    updatedAt: '08-10 14:12',
    description: '按渠道和账期导出对账差异，支持筛选差异类型并保留导出记录。',
  },
]

export const versionDemoData: VersionItem[] = [
  {
    id: 'VER-260',
    name: 'v2.6.0',
    status: '测试中',
    owner: '林俊杰',
    releaseDate: '2026-08-28',
    requirements: 12,
    plans: 3,
    progress: 68,
    openDefects: 7,
    risk: '中',
  },
  {
    id: 'VER-252',
    name: 'v2.5.2',
    status: '待发布',
    owner: '王立',
    releaseDate: '2026-08-18',
    requirements: 7,
    plans: 2,
    progress: 92,
    openDefects: 2,
    risk: '低',
  },
  {
    id: 'VER-270',
    name: 'v2.7.0',
    status: '规划中',
    owner: '周可',
    releaseDate: '2026-10-15',
    requirements: 5,
    plans: 0,
    progress: 12,
    openDefects: 0,
    risk: '低',
  },
  {
    id: 'VER-251',
    name: 'v2.5.1',
    status: '已发布',
    owner: '李敏',
    releaseDate: '2026-07-30',
    requirements: 9,
    plans: 2,
    progress: 100,
    openDefects: 0,
    risk: '低',
  },
]

export const planDemoData: TestPlanItem[] = [
  {
    id: 'TP-2026-034',
    name: 'v2.6.0 核心业务回归',
    version: 'v2.6.0',
    owner: '陈晨',
    status: '进行中',
    scope: '核心回归',
    cases: 126,
    executed: 84,
    passed: 76,
    endDate: '2026-08-22',
  },
  {
    id: 'TP-2026-033',
    name: '退款审批专项测试',
    version: 'v2.6.0',
    owner: '林俊杰',
    status: '进行中',
    scope: '需求专项',
    cases: 36,
    executed: 31,
    passed: 28,
    endDate: '2026-08-19',
  },
  {
    id: 'TP-2026-031',
    name: 'v2.5.2 发布前验收',
    version: 'v2.5.2',
    owner: '王立',
    status: '已完成',
    scope: '发布验收',
    cases: 98,
    executed: 98,
    passed: 96,
    endDate: '2026-08-14',
  },
  {
    id: 'TP-2026-035',
    name: '账户风控探索性测试',
    version: 'v2.7.0',
    owner: '周可',
    status: '未开始',
    scope: '探索测试',
    cases: 28,
    executed: 0,
    passed: 0,
    endDate: '2026-09-08',
  },
]
