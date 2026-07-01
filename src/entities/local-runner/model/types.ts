export interface RunnerNodeSummary {
  runnerId: string
  runnerName: string | null
  status: string | null
  runnerVersion: string | null
  protocolVersion: string | null
  capabilities: string[]
  resource: Record<string, unknown>
  browser: Record<string, unknown>
  session: Record<string, unknown>
  lastHeartbeatAt: string | null
  secondsSinceHeartbeat: number | null
  offline: boolean
  activeTasks: RunnerActiveTaskSummary[]
  selectable?: boolean | null
  unselectableReason?: string | null
}

export interface RunnerActiveTaskSummary {
  runId: string
  taskType: string | null
  status: string | null
  currentStage: string | null
  progressPercent: number | null
  resourceCost: number | null
  assignedAt: string | null
  startedAt: string | null
  lastReportedAt: string | null
  runningSeconds: number | null
}

export interface RunnerOfflineScanResult {
  changedTasks: number
  offlineTasks?: number | null
  timedOutTasks?: number | null
}

export interface RunnerTaskAckResponse {
  runId: string
  status: string
  accepted: boolean
  message: string | null
}

export interface LocalRunnerTaskDetailResponse {
  runId: string
  taskType: string
  runnerId: string | null
  status: string
  currentStage: string | null
  progress: {
    current: number
    total: number
    percent: number
  }
  statusMessage: string | null
  errorMessage: string | null
  assignedAt: string | null
  startedAt: string | null
  completedAt: string | null
  lastReportedAt: string | null
  envelope?: Record<string, unknown> | null
  result: Record<string, unknown>
  logs: LocalRunnerTaskLogEntry[]
}

export interface LocalRunnerTaskLogEntry {
  sequenceNo: number | null
  level: string
  message: string | null
  stepId: string | null
  data: Record<string, unknown>
  loggedAt: string | null
}
