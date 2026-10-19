package com.company.autoplatform.execution;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.platformadmin.PlatformTaskCompletionNotificationService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceMapper;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ExecutionTaskDomainService {

    private static final Set<String> TASK_STATUSES = Set.of("READY", "RUNNING", "SUCCESS", "FAILED", "CANCELED");
    private static final Set<String> REPORT_LOG_SOURCES = Set.of("MANUAL", "API", "API_LOCAL_RUNNER", "WEB", "APP", "SYSTEM");
    private static final String DEFAULT_LOG_SOURCE = "MANUAL";
    private static final long DEFAULT_TASK_PAGE_SIZE = 20;

    private final TaskMapper taskMapper;
    private final ReportMapper reportMapper;
    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceService workspaceService;
    private final PlatformTaskCompletionNotificationService taskNotificationService;

    @Autowired
    public ExecutionTaskDomainService(
            TaskMapper taskMapper,
            ReportMapper reportMapper,
            WorkspaceMapper workspaceMapper,
            WorkspaceService workspaceService,
            PlatformTaskCompletionNotificationService taskNotificationService
    ) {
        this.taskMapper = taskMapper;
        this.reportMapper = reportMapper;
        this.workspaceMapper = workspaceMapper;
        this.workspaceService = workspaceService;
        this.taskNotificationService = taskNotificationService;
    }

    ExecutionTaskDomainService(
            TaskMapper taskMapper,
            ReportMapper reportMapper,
            WorkspaceMapper workspaceMapper,
            WorkspaceService workspaceService
    ) {
        this(taskMapper, reportMapper, workspaceMapper, workspaceService, null);
    }

    ExecutionTaskDomainService(
            TaskMapper taskMapper,
            ReportMapper reportMapper,
            WorkspaceService workspaceService
    ) {
        this(taskMapper, reportMapper, null, workspaceService, null);
    }

    public PageResponse<TaskSummaryResponse> listTasks(
            String workspaceCode,
            String keyword,
            String status,
            String engineType,
            Long pageNo,
            Long pageSize
    ) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        LambdaQueryWrapper<TaskEntity> query = new LambdaQueryWrapper<>();
        if (!WorkspaceScope.isAll(normalized)) {
            WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
            query.eq(TaskEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return new PageResponse<>(List.of(), 0);
            }
            query.in(TaskEntity::getWorkspaceId, workspaceIds);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(TaskEntity::getTaskName, trimmedKeyword)
                    .or()
                    .like(TaskEntity::getSummary, trimmedKeyword));
        }
        String normalizedStatus = blankToNull(status);
        if (normalizedStatus != null) {
            query.eq(TaskEntity::getTaskStatus, normalizeTaskStatus(normalizedStatus));
        }
        String normalizedEngineType = blankToNull(engineType);
        if (normalizedEngineType != null) {
            query.eq(TaskEntity::getEngineType, normalizeEngineType(normalizedEngineType));
        }

        long safePageNo = pageNo == null || pageNo <= 0 ? 1 : pageNo;
        long safePageSize = pageSize == null || pageSize <= 0 ? DEFAULT_TASK_PAGE_SIZE : pageSize;
        Page<TaskEntity> page = taskMapper.selectPage(
                new Page<>(safePageNo, safePageSize),
                query.orderByAsc(TaskEntity::getId)
        );
        List<TaskEntity> records = page.getRecords();
        List<Long> workspaceIds = records.stream()
                .map(TaskEntity::getWorkspaceId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, WorkspaceEntity> workspaces = workspaceMapper == null || workspaceIds.isEmpty()
                ? Map.of()
                : workspaceMapper.selectBatchIds(workspaceIds).stream()
                .collect(Collectors.toMap(WorkspaceEntity::getId, Function.identity(), (first, ignored) -> first, LinkedHashMap::new));
        var items = records.stream()
                .map(task -> toTaskSummary(task, workspaces))
                .toList();
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    public TaskStatsResponse taskStats(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        QueryWrapper<TaskEntity> query = new QueryWrapper<>();
        if (!WorkspaceScope.isAll(normalized)) {
            WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
            query.eq("workspace_id", workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                return new TaskStatsResponse(0, 0, 0);
            }
            query.in("workspace_id", workspaceIds);
        }

        List<Map<String, Object>> rows = taskMapper.selectMaps(query
                .select("task_status", "COUNT(*) AS task_count")
                .groupBy("task_status"));
        long total = 0;
        long running = 0;
        long failed = 0;
        for (Map<String, Object> row : rows) {
            long count = numericValue(row, "task_count");
            total += count;
            String status = String.valueOf(row.get("task_status")).toUpperCase();
            if ("RUNNING".equals(status)) {
                running += count;
            } else if ("FAILED".equals(status)) {
                failed += count;
            }
        }
        return new TaskStatsResponse(total, running, failed);
    }

    public TaskDetailResponse getTask(Long id, String workspaceCode) {
        TaskEntity entity = requireTask(id);
        validateReadableWorkspace(entity.getWorkspaceId(), workspaceCode, "璇ヤ换鍔?");
        return toTaskDetail(entity);
    }

    public TaskSummaryResponse createTask(String headerWorkspaceCode, CreateTaskRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        TaskEntity entity = new TaskEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setCreatorUserId(CurrentUserContext.get());
        entity.setTaskName(request.taskName().trim());
        entity.setEngineType(normalizeEngineType(request.engineType()));
        entity.setTaskStatus(normalizeTaskStatus(request.status()));
        entity.setSummary(blankToNull(request.summary()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        taskMapper.insert(entity);
        return getTaskSummary(entity.getId());
    }

    public TaskSummaryResponse updateTask(Long id, String headerWorkspaceCode, CreateTaskRequest request) {
        TaskEntity entity = requireTask(id);
        validateReadableWorkspace(entity.getWorkspaceId(), headerWorkspaceCode, "璇ヤ换鍔?");
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        if (!entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("涓嶅厑璁镐慨鏀逛换鍔″綊灞炵┖闂?");
        }
        entity.setTaskName(request.taskName().trim());
        entity.setEngineType(normalizeEngineType(request.engineType()));
        entity.setTaskStatus(normalizeTaskStatus(request.status()));
        entity.setSummary(blankToNull(request.summary()));
        entity.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(entity);
        return getTaskSummary(id);
    }

    public void deleteTask(Long id, String workspaceCode) {
        TaskEntity entity = requireTask(id);
        validateReadableWorkspace(entity.getWorkspaceId(), workspaceCode, "璇ヤ换鍔?");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        long reportCount = reportMapper.selectCount(new LambdaQueryWrapper<ReportEntity>()
                .eq(ReportEntity::getTaskId, id));
        if (reportCount > 0) {
            throw new BadRequestException("浠诲姟涓嬪凡鏈夊叧鑱旀姤鍛婏紝涓嶈兘鐩存帴鍒犻櫎");
        }
        taskMapper.deleteById(id);
    }

    public TaskDetailResponse transitionTask(Long id, String workspaceCode, TaskTransitionRequest request) {
        TaskEntity entity = requireTask(id);
        validateReadableWorkspace(entity.getWorkspaceId(), workspaceCode, "璇ヤ换鍔?");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        String targetStatus = normalizeTaskStatus(request.toStatus());
        validateTaskTransition(entity.getTaskStatus(), targetStatus);
        entity.setTaskStatus(targetStatus);
        entity.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(entity);
        if (taskNotificationService != null && Set.of("SUCCESS", "FAILED", "CANCELED").contains(targetStatus)) {
            taskNotificationService.notifyCompleted(entity);
        }
        return toTaskDetail(entity);
    }

    TaskEntity requireTask(Long taskId) {
        TaskEntity task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new NotFoundException("浠诲姟涓嶅瓨鍦?");
        }
        return task;
    }

    private TaskSummaryResponse getTaskSummary(Long id) {
        return toTaskSummary(requireTask(id));
    }

    private TaskSummaryResponse toTaskSummary(TaskEntity item) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(item.getWorkspaceId());
        return toTaskSummary(item, workspace);
    }

    private TaskSummaryResponse toTaskSummary(TaskEntity item, Map<Long, WorkspaceEntity> workspaces) {
        WorkspaceEntity workspace = workspaces.get(item.getWorkspaceId());
        if (workspace == null) {
            throw new NotFoundException("任务所属工作空间不存在");
        }
        return toTaskSummary(item, workspace);
    }

    private TaskSummaryResponse toTaskSummary(TaskEntity item, WorkspaceEntity workspace) {
        return new TaskSummaryResponse(
                item.getId(),
                item.getTaskName(),
                item.getEngineType(),
                item.getTaskStatus(),
                item.getSummary(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName()
        );
    }

    private TaskDetailResponse toTaskDetail(TaskEntity item) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(item.getWorkspaceId());
        List<ReportSummaryResponse> reports = reportMapper.selectList(new LambdaQueryWrapper<ReportEntity>()
                        .eq(ReportEntity::getTaskId, item.getId())
                        .orderByAsc(ReportEntity::getId))
                .stream()
                .map(this::toReportSummary)
                .toList();
        return new TaskDetailResponse(
                item.getId(),
                item.getTaskName(),
                item.getEngineType(),
                item.getTaskStatus(),
                item.getSummary(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                item.getCreatedAt(),
                item.getUpdatedAt(),
                reports
        );
    }

    private ReportSummaryResponse toReportSummary(ReportEntity item) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(item.getWorkspaceId());
        return new ReportSummaryResponse(
                item.getId(),
                item.getTaskId(),
                item.getReportName(),
                item.getResult(),
                normalizeLogSource(item.getLogSource()),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                item.getFailureSummary()
        );
    }

    private void validateReadableWorkspace(Long workspaceId, String workspaceCode, String entityLabel) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            if (!workspaceService.isPlatformAdmin() && !workspaceService.listReadableWorkspaceIds().contains(workspaceId)) {
                throw new BadRequestException("褰撳墠绌洪棿瑙嗚涓嬩笉鍙闂?" + entityLabel);
            }
            return;
        }
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
        if (!workspace.getId().equals(workspaceId)) {
            throw new BadRequestException("褰撳墠绌洪棿瑙嗚涓嬩笉鍙闂?" + entityLabel);
        }
    }

    private void validateTaskTransition(String currentStatus, String targetStatus) {
        if (currentStatus.equals(targetStatus)) {
            throw new BadRequestException("浠诲姟宸茬粡澶勪簬璇ョ姸鎬?");
        }
        boolean allowed = switch (currentStatus) {
            case "READY" -> "RUNNING".equals(targetStatus) || "CANCELED".equals(targetStatus);
            case "RUNNING" -> "SUCCESS".equals(targetStatus) || "FAILED".equals(targetStatus) || "CANCELED".equals(targetStatus);
            default -> false;
        };
        if (!allowed) {
            throw new BadRequestException("褰撳墠浠诲姟鐘舵€佷笉鍏佽杩欐牱娴佽浆");
        }
    }

    private String normalizeTaskStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!TASK_STATUSES.contains(normalized)) {
            throw new BadRequestException("鏃犳晥鐨勪换鍔＄姸鎬? " + status);
        }
        return normalized;
    }

    private long numericValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value == null) {
            value = row.entrySet().stream()
                    .filter(entry -> key.equalsIgnoreCase(String.valueOf(entry.getKey())))
                    .map(Map.Entry::getValue)
                    .findFirst()
                    .orElse(null);
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return value == null ? 0 : Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String normalizeLogSource(String logSource) {
        String normalized = logSource == null ? DEFAULT_LOG_SOURCE : logSource.trim().toUpperCase();
        if (normalized.isEmpty()) {
            normalized = DEFAULT_LOG_SOURCE;
        }
        if ("INLINE".equals(normalized)) {
            normalized = DEFAULT_LOG_SOURCE;
        }
        if (!REPORT_LOG_SOURCES.contains(normalized)) {
            throw new BadRequestException("鏃犳晥鐨勬棩蹇楁潵婧? " + logSource);
        }
        return normalized;
    }

    private String normalizeEngineType(String engineType) {
        String normalized = engineType == null ? "" : engineType.trim().toUpperCase();
        if (normalized.isEmpty()) {
            throw new BadRequestException("鎵ц寮曟搸涓嶈兘涓虹┖");
        }
        return normalized;
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
