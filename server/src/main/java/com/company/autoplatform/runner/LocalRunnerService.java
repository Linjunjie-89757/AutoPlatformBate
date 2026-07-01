package com.company.autoplatform.runner;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.company.autoplatform.runner.LocalRunnerModels.*;

@Service
public class LocalRunnerService {

    private static final int DEFAULT_POLL_INTERVAL_MS = 2000;
    private static final int TASK_DETAIL_LOG_LIMIT = 200;
    private static final String ONLINE = "ONLINE";
    private static final String PENDING = "PENDING";
    private static final String ASSIGNED = "ASSIGNED";
    private static final String RUNNING = "RUNNING";
    private static final List<String> TERMINAL_STATUSES = List.of(
            "SUCCESS",
            "FAILED",
            "CANCELED",
            "CANCELLED",
            "DEGRADED",
            "TIMEOUT",
            "RUNNER_OFFLINE"
    );

    private final LocalRunnerNodeMapper nodeMapper;
    private final LocalRunnerTaskMapper taskMapper;
    private final LocalRunnerTaskLogMapper taskLogMapper;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    public LocalRunnerService(
            LocalRunnerNodeMapper nodeMapper,
            LocalRunnerTaskMapper taskMapper,
            LocalRunnerTaskLogMapper taskLogMapper,
            ObjectMapper objectMapper,
            ApplicationEventPublisher eventPublisher
    ) {
        this.nodeMapper = nodeMapper;
        this.taskMapper = taskMapper;
        this.taskLogMapper = taskLogMapper;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public RunnerRegisterResponse register(RunnerRegisterRequest request) {
        LocalDateTime now = LocalDateTime.now();
        String installId = requireText(request.installId(), "installId cannot be blank");
        LocalRunnerNodeEntity entity = nodeMapper.selectOne(new LambdaQueryWrapper<LocalRunnerNodeEntity>()
                .eq(LocalRunnerNodeEntity::getInstallId, installId)
                .last("LIMIT 1"));
        if (entity == null) {
            entity = new LocalRunnerNodeEntity();
            entity.setRunnerId("runner_" + UUID.randomUUID().toString().replace("-", ""));
            entity.setRunnerToken(UUID.randomUUID().toString().replace("-", ""));
            entity.setInstallId(installId);
            entity.setCreatedAt(now);
        }
        entity.setRunnerName(resolveRunnerName(request.machineHint(), entity.getRunnerId()));
        entity.setRunnerVersion(blankToDefault(request.runnerVersion(), "unknown"));
        entity.setProtocolVersion(blankToDefault(request.protocolVersion(), "1.0"));
        entity.setCapabilitiesJson(writeJson(request.capabilities() == null ? List.of() : request.capabilities()));
        entity.setMachineHintJson(writeJson(request.machineHint() == null ? Map.of() : request.machineHint()));
        entity.setStatus(ONLINE);
        entity.setLastHeartbeatAt(now);
        entity.setUpdatedAt(now);
        if (entity.getId() == null) {
            nodeMapper.insert(entity);
        } else {
            nodeMapper.updateById(entity);
        }
        return new RunnerRegisterResponse(
                entity.getRunnerId(),
                entity.getRunnerToken(),
                entity.getRunnerName(),
                entity.getProtocolVersion(),
                true,
                "Runner registered"
        );
    }

    @Transactional
    public RunnerTaskAckResponse heartbeat(RunnerHealthPayload payload) {
        LocalRunnerNodeEntity entity = requireRunner(payload.runnerId());
        validateRunnerToken(entity, payload.runnerToken());
        LocalDateTime now = LocalDateTime.now();
        entity.setRunnerVersion(blankToDefault(payload.runnerVersion(), entity.getRunnerVersion()));
        entity.setProtocolVersion(blankToDefault(payload.protocolVersion(), entity.getProtocolVersion()));
        entity.setCapabilitiesJson(writeJson(payload.capabilities() == null ? List.of() : payload.capabilities()));
        entity.setResourceJson(writeJson(payload.resource() == null ? Map.of() : payload.resource()));
        entity.setBrowserJson(writeJson(payload.browser() == null ? Map.of() : payload.browser()));
        entity.setSessionJson(writeJson(buildHeartbeatSessionSnapshot(payload)));
        entity.setStatus(ONLINE);
        entity.setLastHeartbeatAt(now);
        entity.setUpdatedAt(now);
        nodeMapper.updateById(entity);
        return new RunnerTaskAckResponse(payload.currentRunId(), ONLINE, true, "Heartbeat accepted");
    }

    private Map<String, Object> buildHeartbeatSessionSnapshot(RunnerHealthPayload payload) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        if (payload.session() != null) {
            snapshot.putAll(payload.session());
        }
        String currentTaskId = blankToNull(payload.currentTaskId());
        if (currentTaskId != null) {
            snapshot.put("currentTaskId", currentTaskId);
        }
        String currentRunId = blankToNull(payload.currentRunId());
        if (currentRunId != null) {
            snapshot.put("currentRunId", currentRunId);
        }
        if (payload.queueSize() != null) {
            snapshot.put("queueSize", Math.max(0, payload.queueSize()));
        }
        return snapshot;
    }

    @Transactional
    public PullRunnerTaskResponse pullTask(PullRunnerTaskRequest request) {
        LocalRunnerNodeEntity runner = requireRunner(request.runnerId());
        validateRunnerToken(runner, request.runnerToken());
        heartbeat(new RunnerHealthPayload(
                request.runnerId(),
                request.runnerToken(),
                request.runnerVersion(),
                request.protocolVersion(),
                request.capabilities(),
                null,
                null,
                null,
                request.resource(),
                null,
                null
        ));

        List<LocalRunnerTaskEntity> candidates = taskMapper.selectList(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                .eq(LocalRunnerTaskEntity::getStatus, PENDING)
                .and(wrapper -> wrapper
                        .isNull(LocalRunnerTaskEntity::getRunnerId)
                        .or()
                        .eq(LocalRunnerTaskEntity::getRunnerId, request.runnerId()))
                .orderByAsc(LocalRunnerTaskEntity::getCreatedAt)
                .last("LIMIT 50"));
        LocalRunnerTaskEntity task = selectPullableTask(candidates, request);
        if (task == null) {
            return new PullRunnerTaskResponse(false, LocalDateTime.now(), DEFAULT_POLL_INTERVAL_MS, null);
        }
        LocalDateTime now = LocalDateTime.now();
        task.setRunnerId(request.runnerId());
        task.setStatus(ASSIGNED);
        task.setAssignedAt(now);
        task.setLastReportedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);
        return new PullRunnerTaskResponse(true, now, DEFAULT_POLL_INTERVAL_MS, toEnvelope(task));
    }

    private LocalRunnerTaskEntity selectPullableTask(List<LocalRunnerTaskEntity> candidates, PullRunnerTaskRequest request) {
        int availableSlots = resolveAvailableSlots(request.resource());
        List<String> capabilities = request.capabilities() == null ? List.of() : request.capabilities();
        List<String> workspaceCodes = request.workspaceCodes() == null ? List.of() : request.workspaceCodes();
        return (candidates == null ? List.<LocalRunnerTaskEntity>of() : candidates).stream()
                .filter(task -> task != null)
                .filter(task -> PENDING.equals(normalizeStatus(task.getStatus(), PENDING)))
                .filter(task -> isTaskAllowedForRunner(task, request.runnerId()))
                .filter(task -> isTaskAllowedForWorkspace(task, workspaceCodes))
                .filter(task -> isTaskAllowedForCapabilities(task, capabilities))
                .filter(task -> defaultResourceCost(task.getResourceCost()) <= availableSlots)
                .min(Comparator
                        .comparingInt((LocalRunnerTaskEntity task) -> priorityRank(task.getPriority()))
                        .thenComparing(LocalRunnerTaskEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(LocalRunnerTaskEntity::getRunId, Comparator.nullsLast(String::compareTo)))
                .orElse(null);
    }

    private boolean isTaskAllowedForRunner(LocalRunnerTaskEntity task, String runnerId) {
        String taskRunnerId = blankToNull(task.getRunnerId());
        return taskRunnerId == null || taskRunnerId.equals(blankToNull(runnerId));
    }

    private boolean isTaskAllowedForWorkspace(LocalRunnerTaskEntity task, List<String> workspaceCodes) {
        String workspaceCode = blankToNull(task.getWorkspaceCode());
        if (workspaceCode == null || workspaceCodes == null || workspaceCodes.isEmpty()) {
            return true;
        }
        return workspaceCodes.stream().anyMatch(code -> workspaceCode.equals(blankToNull(code)));
    }

    private boolean isTaskAllowedForCapabilities(LocalRunnerTaskEntity task, List<String> capabilities) {
        return isTaskAllowedForCapabilities(task.getTaskType(), capabilities);
    }

    private boolean isTaskAllowedForCapabilities(String taskTypeValue, List<String> capabilities) {
        String taskType = blankToNull(taskTypeValue);
        if (taskType == null || capabilities == null || capabilities.isEmpty()) {
            return true;
        }
        return capabilities.stream().anyMatch(capability -> taskType.equalsIgnoreCase(blankToNull(capability)));
    }

    private int resolveAvailableSlots(Map<String, Object> resource) {
        int maxSlots = intFromMap(resource, "maxSlots", 1);
        int usedSlots = intFromMap(resource, "usedSlots", 0);
        int explicitAvailable = intFromMap(resource, "availableSlots", maxSlots - usedSlots);
        return Math.max(0, explicitAvailable);
    }

    private int intFromMap(Map<String, Object> values, String key, int fallback) {
        if (values == null || !values.containsKey(key)) {
            return fallback;
        }
        Object value = values.get(key);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private int defaultResourceCost(Integer value) {
        return value == null || value <= 0 ? 1 : value;
    }

    private int priorityRank(String priority) {
        String normalized = blankToNull(priority);
        if ("DEBUG".equalsIgnoreCase(normalized)) {
            return 0;
        }
        if ("MANUAL".equalsIgnoreCase(normalized)) {
            return 1;
        }
        if ("CI".equalsIgnoreCase(normalized)) {
            return 2;
        }
        if ("SCHEDULED".equalsIgnoreCase(normalized)) {
            return 3;
        }
        return 4;
    }

    @Transactional
    public RunnerTaskAckResponse reportStatus(String runId, RunnerTaskStatusReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        if (isTerminalTask(task)) {
            return terminalTaskAck(task);
        }
        LocalDateTime now = report.reportedAt() == null ? LocalDateTime.now() : report.reportedAt();
        String status = normalizeStatus(report.status(), RUNNING);
        task.setStatus(status);
        task.setCurrentStage(blankToNull(report.currentStage()));
        if (report.progress() != null) {
            task.setProgressCurrent(defaultNumber(report.progress().current()));
            task.setProgressTotal(defaultNumber(report.progress().total()));
            task.setProgressPercent(defaultNumber(report.progress().percent()));
        }
        task.setStatusMessage(blankToNull(report.message()));
        if (RUNNING.equals(status) && task.getStartedAt() == null) {
            task.setStartedAt(now);
        }
        if (isTerminalStatus(status)) {
            task.setCompletedAt(now);
        }
        task.setLastReportedAt(now);
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Status accepted");
    }

    @Transactional
    public RunnerTaskAckResponse appendLog(String runId, RunnerTaskLogReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        if (isTerminalTask(task)) {
            return terminalTaskAck(task);
        }
        Long sequenceNo = report.sequenceNo() == null ? System.currentTimeMillis() : report.sequenceNo();
        Long existing = taskLogMapper.selectCount(new LambdaQueryWrapper<LocalRunnerTaskLogEntity>()
                .eq(LocalRunnerTaskLogEntity::getRunId, runId)
                .eq(LocalRunnerTaskLogEntity::getSequenceNo, sequenceNo));
        if (existing == null || existing == 0) {
            LocalRunnerTaskLogEntity log = new LocalRunnerTaskLogEntity();
            log.setRunId(runId);
            log.setRunnerId(report.runnerId());
            log.setSequenceNo(sequenceNo);
            log.setLevel(blankToDefault(report.level(), "INFO"));
            log.setMessage(blankToNull(report.message()));
            log.setStepId(blankToNull(report.stepId()));
            log.setDataJson(writeJson(report.data() == null ? Map.of() : report.data()));
            log.setLoggedAt(report.timestamp() == null ? LocalDateTime.now() : report.timestamp());
            log.setCreatedAt(LocalDateTime.now());
            log.setUpdatedAt(LocalDateTime.now());
            taskLogMapper.insert(log);
        }
        touchTaskReportTime(task);
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Log accepted");
    }

    @Transactional
    public RunnerTaskAckResponse reportStepResult(String runId, RunnerStepResultReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        if (isTerminalTask(task)) {
            return terminalTaskAck(task);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("stepId", report.stepId());
        data.put("status", blankToDefault(report.status(), "UNKNOWN"));
        data.put("startedAt", report.startedAt());
        data.put("finishedAt", report.finishedAt());
        data.put("durationMs", report.durationMs());
        data.put("errorMessage", report.errorMessage());
        data.put("screenshotRef", report.screenshotRef());
        data.put("extra", report.extra() == null ? Map.of() : report.extra());
        appendLog(runId, new RunnerTaskLogReport(
                report.runnerId(),
                report.executionToken(),
                System.currentTimeMillis(),
                "INFO",
                "Step result: " + report.stepId(),
                report.stepId(),
                data,
                LocalDateTime.now()
        ));
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Step result accepted");
    }

    @Transactional
    public RunnerTaskAckResponse reportFinalResult(String runId, RunnerFinalResultReport report) {
        LocalRunnerTaskEntity task = requireTask(runId);
        validateExecutionToken(task, report.runnerId(), report.executionToken());
        if (isTerminalTask(task)) {
            return terminalTaskAck(task);
        }
        LocalDateTime now = LocalDateTime.now();
        String status = normalizeStatus(report.status(), "SUCCESS");
        task.setStatus(status);
        task.setStartedAt(report.startedAt() == null ? task.getStartedAt() : report.startedAt());
        task.setCompletedAt(report.finishedAt() == null ? now : report.finishedAt());
        task.setErrorMessage(blankToNull(report.errorMessage()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", report.summary() == null ? Map.of() : report.summary());
        result.put("durationMs", report.durationMs());
        result.put("reportData", report.reportData() == null ? Map.of() : report.reportData());
        task.setResultJson(writeJson(result));
        task.setLastReportedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);
        eventPublisher.publishEvent(new LocalRunnerTaskFinalResultEvent(
                task.getRunId(),
                task.getTaskType(),
                task.getStatus(),
                task.getWorkspaceId(),
                task.getWorkspaceCode(),
                task.getRunnerId(),
                readMap(task.getPayloadJson()),
                result
        ));
        return new RunnerTaskAckResponse(runId, task.getStatus(), true, "Final result accepted");
    }

    @Transactional
    public int markOfflineRunners(Duration offlineThreshold) {
        Duration threshold = offlineThreshold == null || offlineThreshold.isNegative() || offlineThreshold.isZero()
                ? Duration.ofMinutes(2)
                : offlineThreshold;
        LocalDateTime deadline = LocalDateTime.now().minus(threshold);
        List<LocalRunnerNodeEntity> staleRunners = nodeMapper.selectList(new LambdaQueryWrapper<LocalRunnerNodeEntity>()
                .eq(LocalRunnerNodeEntity::getStatus, ONLINE)
                .lt(LocalRunnerNodeEntity::getLastHeartbeatAt, deadline));
        int changedTasks = 0;
        for (LocalRunnerNodeEntity runner : staleRunners == null ? List.<LocalRunnerNodeEntity>of() : staleRunners) {
            runner.setStatus("OFFLINE");
            runner.setUpdatedAt(LocalDateTime.now());
            nodeMapper.updateById(runner);
            changedTasks += markRunnerTasksOffline(runner.getRunnerId());
        }
        return changedTasks;
    }

    @Transactional
    public int markTimedOutTasks() {
        LocalDateTime now = LocalDateTime.now();
        List<LocalRunnerTaskEntity> tasks = taskMapper.selectList(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                .in(LocalRunnerTaskEntity::getStatus, List.of(ASSIGNED, RUNNING))
                .isNotNull(LocalRunnerTaskEntity::getDeadlineAt)
                .le(LocalRunnerTaskEntity::getDeadlineAt, now));
        int changed = 0;
        for (LocalRunnerTaskEntity task : tasks == null ? List.<LocalRunnerTaskEntity>of() : tasks) {
            completeTaskWithForcedTerminalStatus(
                    task,
                    "TIMEOUT",
                    "Runner task timed out: deadline " + task.getDeadlineAt(),
                    now
            );
            changed += 1;
        }
        return changed;
    }

    public List<RunnerNodeSummaryResponse> listRunnerNodes(Duration offlineThreshold) {
        return listRunnerNodes(offlineThreshold, null, null);
    }

    public List<RunnerNodeSummaryResponse> listRunnerNodes(Duration offlineThreshold, String taskType, Integer resourceCost) {
        Duration threshold = offlineThreshold == null || offlineThreshold.isNegative() || offlineThreshold.isZero()
                ? Duration.ofMinutes(2)
                : offlineThreshold;
        LocalDateTime now = LocalDateTime.now();
        List<LocalRunnerNodeEntity> nodes = nodeMapper.selectList(new LambdaQueryWrapper<LocalRunnerNodeEntity>()
                .orderByDesc(LocalRunnerNodeEntity::getLastHeartbeatAt));
        Map<String, List<LocalRunnerTaskEntity>> activeTaskMap = activeTasksByRunner(nodes);
        return (nodes == null ? List.<LocalRunnerNodeEntity>of() : nodes).stream()
                .map(node -> toRunnerNodeSummary(
                        node,
                        now,
                        threshold,
                        activeTaskMap.getOrDefault(node.getRunnerId(), List.of()),
                        taskType,
                        resourceCost
                ))
                .toList();
    }

    private Map<String, List<LocalRunnerTaskEntity>> activeTasksByRunner(List<LocalRunnerNodeEntity> nodes) {
        List<String> runnerIds = (nodes == null ? List.<LocalRunnerNodeEntity>of() : nodes).stream()
                .map(LocalRunnerNodeEntity::getRunnerId)
                .filter(runnerId -> blankToNull(runnerId) != null)
                .toList();
        if (runnerIds.isEmpty()) {
            return Map.of();
        }
        List<LocalRunnerTaskEntity> tasks = taskMapper.selectList(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                .in(LocalRunnerTaskEntity::getRunnerId, runnerIds)
                .in(LocalRunnerTaskEntity::getStatus, List.of(ASSIGNED, RUNNING))
                .orderByAsc(LocalRunnerTaskEntity::getAssignedAt));
        return (tasks == null ? List.<LocalRunnerTaskEntity>of() : tasks).stream()
                .collect(java.util.stream.Collectors.groupingBy(LocalRunnerTaskEntity::getRunnerId));
    }

    private int markRunnerTasksOffline(String runnerId) {
        String normalizedRunnerId = blankToNull(runnerId);
        if (normalizedRunnerId == null) {
            return 0;
        }
        List<LocalRunnerTaskEntity> tasks = taskMapper.selectList(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                .eq(LocalRunnerTaskEntity::getRunnerId, normalizedRunnerId)
                .in(LocalRunnerTaskEntity::getStatus, List.of(ASSIGNED, RUNNING)));
        int changed = 0;
        LocalDateTime now = LocalDateTime.now();
        for (LocalRunnerTaskEntity task : tasks == null ? List.<LocalRunnerTaskEntity>of() : tasks) {
            completeTaskWithForcedTerminalStatus(
                    task,
                    "RUNNER_OFFLINE",
                    "Runner offline: " + normalizedRunnerId,
                    now
            );
            changed += 1;
        }
        return changed;
    }

    private RunnerNodeSummaryResponse toRunnerNodeSummary(
            LocalRunnerNodeEntity node,
            LocalDateTime now,
            Duration offlineThreshold,
            List<LocalRunnerTaskEntity> activeTasks,
            String requestedTaskType,
            Integer requestedResourceCost
    ) {
        Long secondsSinceHeartbeat = node.getLastHeartbeatAt() == null
                ? null
                : Math.max(0, Duration.between(node.getLastHeartbeatAt(), now).toSeconds());
        boolean offline = secondsSinceHeartbeat == null
                || secondsSinceHeartbeat > offlineThreshold.toSeconds()
                || "OFFLINE".equalsIgnoreCase(blankToNull(node.getStatus()));
        List<String> capabilities = readStringList(node.getCapabilitiesJson());
        String unselectableReason = resolveUnselectableReason(
                offline,
                capabilities,
                readMap(node.getResourceJson()),
                requestedTaskType,
                requestedResourceCost
        );
        return new RunnerNodeSummaryResponse(
                node.getRunnerId(),
                node.getRunnerName(),
                node.getStatus(),
                node.getRunnerVersion(),
                node.getProtocolVersion(),
                capabilities,
                readMap(node.getResourceJson()),
                readMap(node.getBrowserJson()),
                readMap(node.getSessionJson()),
                node.getLastHeartbeatAt(),
                secondsSinceHeartbeat,
                offline,
                toActiveTaskSummaries(activeTasks, now),
                unselectableReason == null,
                unselectableReason
        );
    }

    private String resolveUnselectableReason(
            boolean offline,
            List<String> capabilities,
            Map<String, Object> resource,
            String requestedTaskType,
            Integer requestedResourceCost
    ) {
        if (offline) {
            return "Runner is offline";
        }
        String taskType = blankToNull(requestedTaskType);
        if (taskType != null && !isTaskAllowedForCapabilities(taskType, capabilities)) {
            return "Runner does not support task type: " + taskType;
        }
        int resourceCost = defaultResourceCost(requestedResourceCost);
        if (resourceCost > 0 && resourceCost > resolveAvailableSlots(resource)) {
            return "Insufficient resource slots";
        }
        return null;
    }

    private List<RunnerActiveTaskSummary> toActiveTaskSummaries(List<LocalRunnerTaskEntity> tasks, LocalDateTime now) {
        return (tasks == null ? List.<LocalRunnerTaskEntity>of() : tasks).stream()
                .filter(task -> ASSIGNED.equals(normalizeStatus(task.getStatus(), "")) || RUNNING.equals(normalizeStatus(task.getStatus(), "")))
                .map(task -> toActiveTaskSummary(task, now))
                .toList();
    }

    private RunnerActiveTaskSummary toActiveTaskSummary(LocalRunnerTaskEntity task, LocalDateTime now) {
        LocalDateTime runningFrom = task.getStartedAt() == null ? task.getAssignedAt() : task.getStartedAt();
        Long runningSeconds = runningFrom == null ? null : Math.max(0, Duration.between(runningFrom, now).toSeconds());
        return new RunnerActiveTaskSummary(
                task.getRunId(),
                task.getTaskType(),
                task.getStatus(),
                task.getCurrentStage(),
                task.getProgressPercent(),
                task.getResourceCost(),
                task.getAssignedAt(),
                task.getStartedAt(),
                task.getLastReportedAt(),
                runningSeconds
        );
    }

    @Transactional
    public LocalRunnerTaskEntity createTask(CreateRunnerTaskCommand command) {
        LocalDateTime now = LocalDateTime.now();
        String requestedRunId = blankToNull(command.runId());
        if (requestedRunId != null) {
            LocalRunnerTaskEntity existing = taskMapper.selectOne(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                    .eq(LocalRunnerTaskEntity::getRunId, requestedRunId)
                    .last("LIMIT 1"));
            if (existing != null) {
                return existing;
            }
        }
        LocalRunnerTaskEntity entity = new LocalRunnerTaskEntity();
        validateRequestedRunner(command);
        entity.setWorkspaceId(command.workspaceId());
        entity.setWorkspaceCode(blankToNull(command.workspaceCode()));
        entity.setRunId(blankToDefault(requestedRunId, "run_" + UUID.randomUUID().toString().replace("-", "")));
        entity.setTaskType(requireText(command.taskType(), "taskType cannot be blank"));
        entity.setExecutionLocation(blankToDefault(command.executionLocation(), "LOCAL_RUNNER"));
        entity.setExecutionToken(UUID.randomUUID().toString().replace("-", ""));
        entity.setRunnerId(blankToNull(command.runnerId()));
        entity.setUserId(blankToNull(command.userId()));
        entity.setProtocolVersion(blankToDefault(command.protocolVersion(), "1.0"));
        entity.setPriority(blankToDefault(command.priority(), "MANUAL"));
        entity.setResourceCost(command.resourceCost() == null || command.resourceCost() <= 0 ? 1 : command.resourceCost());
        entity.setStatus(PENDING);
        entity.setProgressCurrent(0);
        entity.setProgressTotal(0);
        entity.setProgressPercent(0);
        entity.setDeadlineAt(command.deadlineAt());
        entity.setTimeoutPolicyJson(writeJson(command.timeoutPolicy() == null ? Map.of() : command.timeoutPolicy()));
        entity.setEnvironmentSnapshotJson(writeJson(command.environmentSnapshot() == null ? Map.of() : command.environmentSnapshot()));
        entity.setVariableSnapshotJson(writeJson(command.variableSnapshot() == null ? Map.of() : command.variableSnapshot()));
        entity.setScriptSnapshotJson(writeJson(command.scriptSnapshot() == null ? Map.of() : command.scriptSnapshot()));
        entity.setArtifactRefsJson(writeJson(command.artifactRefs() == null ? List.of() : command.artifactRefs()));
        entity.setMaskingRulesJson(writeJson(command.maskingRules() == null ? List.of() : command.maskingRules()));
        entity.setScreenshotPolicyJson(writeJson(command.screenshotPolicy() == null ? Map.of() : command.screenshotPolicy()));
        entity.setPayloadJson(writeJson(command.payload() == null ? Map.of() : command.payload()));
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        taskMapper.insert(entity);
        return entity;
    }

    @Transactional
    public RunnerTaskDetailResponse createDebugTask(CreateRunnerTaskCommand command) {
        return toTaskDetail(createTask(command));
    }

    public RunnerTaskDetailResponse getTaskDetail(String runId) {
        return toTaskDetail(requireTask(runId));
    }

    @Transactional
    public RunnerTaskAckResponse cancelTask(String runId) {
        LocalRunnerTaskEntity task = requireTask(runId);
        if (isTerminalTask(task)) {
            return terminalTaskAck(task);
        }
        LocalDateTime now = LocalDateTime.now();
        completeTaskWithForcedTerminalStatus(
                task,
                "CANCELED",
                "Runner task canceled by platform",
                now
        );
        return new RunnerTaskAckResponse(task.getRunId(), task.getStatus(), true, "Task canceled");
    }

    public RunnerTaskEnvelope toEnvelope(LocalRunnerTaskEntity task) {
        return new RunnerTaskEnvelope(
                task.getRunId(),
                task.getTaskType(),
                task.getExecutionLocation(),
                task.getExecutionToken(),
                task.getRunnerId(),
                task.getWorkspaceCode(),
                task.getUserId(),
                task.getProtocolVersion(),
                task.getPriority(),
                task.getResourceCost(),
                task.getCreatedAt(),
                task.getDeadlineAt(),
                readMap(task.getTimeoutPolicyJson()),
                readMap(task.getEnvironmentSnapshotJson()),
                readMap(task.getVariableSnapshotJson()),
                readMap(task.getScriptSnapshotJson()),
                readListMap(task.getArtifactRefsJson()),
                readListMap(task.getMaskingRulesJson()),
                readMap(task.getScreenshotPolicyJson()),
                readMap(task.getPayloadJson())
        );
    }

    private RunnerTaskDetailResponse toTaskDetail(LocalRunnerTaskEntity task) {
        return new RunnerTaskDetailResponse(
                task.getRunId(),
                task.getTaskType(),
                task.getRunnerId(),
                task.getStatus(),
                task.getCurrentStage(),
                new Progress(
                        task.getProgressCurrent(),
                        task.getProgressTotal(),
                        task.getProgressPercent()
                ),
                task.getStatusMessage(),
                task.getErrorMessage(),
                task.getAssignedAt(),
                task.getStartedAt(),
                task.getCompletedAt(),
                task.getLastReportedAt(),
                toEnvelope(task),
                readMap(task.getResultJson()),
                recentTaskLogs(task.getRunId())
        );
    }

    private List<RunnerTaskLogEntry> recentTaskLogs(String runId) {
        List<LocalRunnerTaskLogEntity> logs = taskLogMapper.selectList(new LambdaQueryWrapper<LocalRunnerTaskLogEntity>()
                .eq(LocalRunnerTaskLogEntity::getRunId, runId)
                .orderByAsc(LocalRunnerTaskLogEntity::getSequenceNo)
                .orderByAsc(LocalRunnerTaskLogEntity::getLoggedAt)
                .last("LIMIT " + TASK_DETAIL_LOG_LIMIT));
        return (logs == null ? List.<LocalRunnerTaskLogEntity>of() : logs).stream()
                .map(this::toTaskLogEntry)
                .toList();
    }

    private RunnerTaskLogEntry toTaskLogEntry(LocalRunnerTaskLogEntity log) {
        return new RunnerTaskLogEntry(
                log.getSequenceNo(),
                blankToDefault(log.getLevel(), "INFO"),
                blankToNull(log.getMessage()),
                blankToNull(log.getStepId()),
                readMap(log.getDataJson()),
                log.getLoggedAt()
        );
    }

    private void completeTaskWithForcedTerminalStatus(
            LocalRunnerTaskEntity task,
            String status,
            String errorMessage,
            LocalDateTime now
    ) {
        task.setStatus(status);
        task.setStatusMessage(errorMessage);
        task.setErrorMessage(errorMessage);
        task.setCompletedAt(now);
        task.setLastReportedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);
        eventPublisher.publishEvent(new LocalRunnerTaskFinalResultEvent(
                task.getRunId(),
                task.getTaskType(),
                task.getStatus(),
                task.getWorkspaceId(),
                task.getWorkspaceCode(),
                task.getRunnerId(),
                readMap(task.getPayloadJson()),
                buildForcedTerminalResult(task, errorMessage, now)
        ));
    }

    private Map<String, Object> buildForcedTerminalResult(
            LocalRunnerTaskEntity task,
            String errorMessage,
            LocalDateTime now
    ) {
        Map<String, Object> stepResult = new LinkedHashMap<>();
        stepResult.put("stepId", "local-runner-terminal");
        stepResult.put("stepName", "Local Runner terminal state");
        stepResult.put("status", "FAILED");
        stepResult.put("durationMs", 0);
        stepResult.put("errorMessage", errorMessage);
        stepResult.put("request", Map.of());
        stepResult.put("response", Map.of());
        stepResult.put("assertions", List.of());
        stepResult.put("extractedVariables", Map.of());
        stepResult.put("scriptResults", Map.of());
        stepResult.put("extra", Map.of("sortOrder", 1));

        Map<String, Object> reportData = new LinkedHashMap<>();
        reportData.put("request", Map.of());
        reportData.put("response", Map.of());
        reportData.put("assertions", List.of());
        reportData.put("extractedVariables", Map.of());
        reportData.put("scriptResults", Map.of());
        reportData.put("stepResults", List.of(stepResult));
        reportData.put("itemSnapshots", List.of());

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalSteps", 1);
        summary.put("passedSteps", 0);
        summary.put("failedSteps", 1);
        summary.put("skippedSteps", 0);
        summary.put("errorMessage", errorMessage);
        summary.put("forcedByPlatform", true);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("durationMs", forcedDurationMs(task, now));
        result.put("errorMessage", errorMessage);
        result.put("reportData", reportData);
        return result;
    }

    private long forcedDurationMs(LocalRunnerTaskEntity task, LocalDateTime now) {
        LocalDateTime startedAt = task.getStartedAt();
        if (startedAt == null) {
            startedAt = task.getAssignedAt();
        }
        if (startedAt == null) {
            startedAt = task.getCreatedAt();
        }
        return startedAt == null ? 0L : Math.max(0L, Duration.between(startedAt, now).toMillis());
    }

    private LocalRunnerNodeEntity requireRunner(String runnerId) {
        String normalized = requireText(runnerId, "runnerId cannot be blank");
        LocalRunnerNodeEntity entity = nodeMapper.selectOne(new LambdaQueryWrapper<LocalRunnerNodeEntity>()
                .eq(LocalRunnerNodeEntity::getRunnerId, normalized)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new NotFoundException("Runner not registered");
        }
        return entity;
    }

    private void validateRequestedRunner(CreateRunnerTaskCommand command) {
        String requestedRunnerId = blankToNull(command.runnerId());
        if (requestedRunnerId == null) {
            return;
        }
        LocalRunnerNodeEntity runner = requireRunner(requestedRunnerId);
        LocalDateTime lastHeartbeatAt = runner.getLastHeartbeatAt();
        boolean offline = lastHeartbeatAt == null
                || Duration.between(lastHeartbeatAt, LocalDateTime.now()).toSeconds() > Duration.ofMinutes(2).toSeconds()
                || "OFFLINE".equalsIgnoreCase(blankToNull(runner.getStatus()));
        if (offline) {
            throw new BadRequestException("Selected runner is offline");
        }
        List<String> capabilities = readStringList(runner.getCapabilitiesJson());
        if (!isTaskAllowedForCapabilities(command.taskType(), capabilities)) {
            throw new BadRequestException("Selected runner does not support task type: " + command.taskType());
        }
    }

    private LocalRunnerTaskEntity requireTask(String runId) {
        String normalized = requireText(runId, "runId cannot be blank");
        LocalRunnerTaskEntity entity = taskMapper.selectOne(new LambdaQueryWrapper<LocalRunnerTaskEntity>()
                .eq(LocalRunnerTaskEntity::getRunId, normalized)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new NotFoundException("Runner task not found");
        }
        return entity;
    }

    private void validateRunnerToken(LocalRunnerNodeEntity runner, String token) {
        String expected = blankToNull(runner.getRunnerToken());
        if (expected != null && !expected.equals(blankToNull(token))) {
            throw new BadRequestException("Runner token is invalid");
        }
    }

    private void validateExecutionToken(LocalRunnerTaskEntity task, String runnerId, String token) {
        if (!task.getExecutionToken().equals(blankToNull(token))) {
            throw new BadRequestException("Task execution token is invalid or expired");
        }
        String taskRunnerId = blankToNull(task.getRunnerId());
        if (taskRunnerId != null && !taskRunnerId.equals(blankToNull(runnerId))) {
            throw new BadRequestException("Task is assigned to another runner");
        }
    }

    private void touchTaskReportTime(LocalRunnerTaskEntity task) {
        task.setLastReportedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);
    }

    private boolean isTerminalStatus(String status) {
        return TERMINAL_STATUSES.contains(status);
    }

    private boolean isTerminalTask(LocalRunnerTaskEntity task) {
        return isTerminalStatus(normalizeStatus(task.getStatus(), ""));
    }

    private RunnerTaskAckResponse terminalTaskAck(LocalRunnerTaskEntity task) {
        String status = normalizeStatus(task.getStatus(), "");
        return new RunnerTaskAckResponse(
                task.getRunId(),
                status,
                false,
                "Task already reached terminal status: " + status
        );
    }

    private String normalizeStatus(String status, String fallback) {
        String normalized = blankToNull(status);
        if (normalized == null) {
            return fallback;
        }
        String upper = normalized.toUpperCase();
        return "CANCELLED".equals(upper) ? "CANCELED" : upper;
    }

    private String resolveRunnerName(Map<String, Object> machineHint, String fallback) {
        if (machineHint != null) {
            Object name = machineHint.get("deviceName");
            if (name instanceof String text && blankToNull(text) != null) {
                return text.trim();
            }
        }
        return fallback;
    }

    private String requireText(String value, String message) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            throw new BadRequestException(message);
        }
        return normalized;
    }

    private String blankToDefault(String value, String fallback) {
        String normalized = blankToNull(value);
        return normalized == null ? fallback : normalized;
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private int defaultNumber(Integer value) {
        return value == null ? 0 : value;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Runner task JSON serialization failed");
        }
    }

    private Map<String, Object> readMap(String json) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException exception) {
            return Map.of();
        }
    }

    private List<String> readStringList(String json) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return List.of();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<List<String>>() {
            });
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private List<Map<String, Object>> readListMap(String json) {
        String normalized = blankToNull(json);
        if (normalized == null) {
            return List.of();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<List<Map<String, Object>>>() {
            });
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }
}
