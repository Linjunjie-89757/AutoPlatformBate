package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.casecenter.CaseDirectoryEntity;
import com.company.autoplatform.casecenter.CaseDirectoryMapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AiGenerationTaskDomainService {

    static final int MAX_REQUIREMENT_CONTENT_LENGTH = 200_000;
    private static final List<String> RUNNING_STATUSES = List.of("PENDING", "GENERATING", "REVIEWING");

    private final AiGenerationTaskMapper aiGenerationTaskMapper;
    private final AiCaseService aiCaseService;
    private final AiGenerationTaskEventService eventService;
    private final AiGenerationTaskResponseSupport responseSupport;
    private final WorkspaceService workspaceService;
    private final CaseDirectoryMapper caseDirectoryMapper;
    private final AiCaseCandidateService candidateService;

    public AiGenerationTaskDomainService(
            AiGenerationTaskMapper aiGenerationTaskMapper,
            AiCaseService aiCaseService,
            AiGenerationTaskEventService eventService,
            AiGenerationTaskResponseSupport responseSupport,
            WorkspaceService workspaceService,
            CaseDirectoryMapper caseDirectoryMapper,
            AiCaseCandidateService candidateService
    ) {
        this.aiGenerationTaskMapper = aiGenerationTaskMapper;
        this.aiCaseService = aiCaseService;
        this.eventService = eventService;
        this.responseSupport = responseSupport;
        this.workspaceService = workspaceService;
        this.caseDirectoryMapper = caseDirectoryMapper;
        this.candidateService = candidateService;
    }

    public AiGenerationTaskResponse createTask(String headerWorkspaceCode, CreateAiGenerationTaskRequest request) {
        String requirementContent = normalizeRequirementContent(request.requirementContent());
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode())
        );
        validateOutputMode(request.outputMode());
        validateDirectory(workspace, request.directoryId());
        int caseGenerationLimit = resolveCaseGenerationLimit();
        AiGenerationTaskEntity entity = new AiGenerationTaskEntity();
        LocalDateTime now = LocalDateTime.now();
        Long currentUserId = CurrentUserContext.get();
        entity.setTaskId(generateTaskId());
        entity.setWorkspaceId(workspace.getId());
        entity.setRequirementTitle(request.requirementTitle().trim());
        entity.setRequirementContent(requirementContent);
        entity.setOutputMode(normalizeOutputMode(request.outputMode()));
        entity.setCaseGenerationLimit(caseGenerationLimit);
        entity.setStatus("PENDING");
        entity.setGenerationStatus("PENDING");
        entity.setReviewStatus("NOT_STARTED");
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setSelfCheckStatus(AiGenerationWorkflowContract.SELF_CHECK_NOT_STARTED);
        entity.setSelfCheckResultJson(null);
        entity.setSelfCheckAttemptCount(0);
        entity.setCurrentStep(1);
        entity.setStepMessage("任务已创建，等待开始生成测试用例。");
        entity.setErrorMessage(null);
        entity.setDirectoryId(request.directoryId());
        entity.setDirectoryName(blankToNull(request.directoryName()));
        entity.setProvider(null);
        entity.setModel(null);
        entity.setGenerationProvider(null);
        entity.setGenerationModel(null);
        entity.setGenerationPromptVersion(null);
        entity.setGenerationPromptHash(null);
        entity.setGenerationTemperature(null);
        entity.setReviewProvider(null);
        entity.setReviewModel(null);
        entity.setReviewPromptVersion(null);
        entity.setReviewPromptHash(null);
        entity.setReviewTemperature(null);
        entity.setAssetIdsJson(responseSupport.writeValue(request.assetIds() == null ? List.of() : request.assetIds()));
        entity.setInputMode(request.assetIds() == null || request.assetIds().isEmpty() ? "TEXT" : "MULTIMODAL");
        entity.setImageCount(request.assetIds() == null ? 0 : request.assetIds().size());
        entity.setImageDigest(null);
        entity.setInputTokenCount(null);
        entity.setOutputTokenCount(null);
        entity.setReviewInputTokenCount(null);
        entity.setReviewOutputTokenCount(null);
        entity.setWarningsJson(responseSupport.writeValue(List.of()));
        entity.setInvalidCasesJson(responseSupport.writeValue(List.of()));
        entity.setGeneratedCasesJson(responseSupport.writeValue(List.of()));
        entity.setReviewResultJson(null);
        entity.setGenerationRawOutput(null);
        entity.setReviewRawOutput(null);
        entity.setWarningCodesJson(responseSupport.writeValue(List.of()));
        entity.setHasWarnings(0);
        entity.setTotalReviewBatches(0);
        entity.setCompletedReviewBatches(0);
        entity.setFailedReviewBatches(0);
        entity.setReviewedCaseCount(0);
        entity.setSupplementedCaseCount(0);
        entity.setCoverageCompleteness("UNKNOWN");
        entity.setAdoptedCaseIndexesJson(responseSupport.writeValue(List.of()));
        entity.setDeletedCaseIndexesJson(responseSupport.writeValue(List.of()));
        entity.setSavedCaseCount(0);
        entity.setGeneratedCount(0);
        entity.setCancelRequested(0);
        entity.setSourceTaskId(null);
        entity.setFinishedAt(null);
        entity.setCreatedBy(currentUserId);
        entity.setUpdatedBy(currentUserId);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        aiGenerationTaskMapper.insert(entity);
        appendEvent(entity.getTaskId(), "TASK_CREATED", "SETUP", "INFO", "任务已创建，等待开始生成", null, null, null, null, null);
        int ignoredAssetCount = request.ignoredAssetCount() == null ? 0 : Math.max(request.ignoredAssetCount(), 0);
        if (ignoredAssetCount > 0) {
            appendEvent(
                    entity.getTaskId(),
                    "IMAGE_ASSETS_IGNORED",
                    "SETUP",
                    "WARN",
                    "当前生成模型不支持图片输入，已忽略 " + ignoredAssetCount + " 个图片素材，仅基于文本需求继续生成。",
                    null,
                    null,
                    null,
                    null,
                    responseSupport.writeValue(Map.of("ignoredAssetCount", ignoredAssetCount))
            );
        }

        return responseSupport.toResponse(entity, workspace, responseSupport.collectUserMap(List.of(entity)));
    }

    public List<AiGenerationTaskResponse> listTasks(String workspaceCode) {
        List<WorkspaceEntity> workspaces = resolveReadableWorkspaces(workspaceCode);
        if (workspaces.isEmpty()) {
            return List.of();
        }
        List<Long> workspaceIds = workspaces.stream().map(WorkspaceEntity::getId).toList();
        List<AiGenerationTaskEntity> tasks = aiGenerationTaskMapper.selectList(new LambdaQueryWrapper<AiGenerationTaskEntity>()
                .in(AiGenerationTaskEntity::getWorkspaceId, workspaceIds)
                .orderByDesc(AiGenerationTaskEntity::getUpdatedAt)
                .orderByDesc(AiGenerationTaskEntity::getId));
        Map<Long, UserEntity> userMap = responseSupport.collectUserMap(tasks);

        return tasks.stream()
                .map(task -> responseSupport.toResponse(task, workspaces.stream()
                        .filter(item -> item.getId().equals(task.getWorkspaceId()))
                        .findFirst()
                        .orElseGet(() -> workspaceService.requireWorkspaceById(task.getWorkspaceId())), userMap, false))
                .toList();
    }

    public AiGenerationTaskResponse getTask(String taskId, String workspaceCode) {
        AiGenerationTaskEntity entity = requireTask(taskId);
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(
                workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode()
        );
        validateReadableWorkspaceScope(workspaceCode, workspace);
        return responseSupport.toResponse(entity, workspace, responseSupport.collectUserMap(List.of(entity)));
    }

    public AiGenerationTaskResponse cancelTask(String taskId, String workspaceCode) {
        AiGenerationTaskEntity entity = requireTask(taskId);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode()
        );
        validateReadableWorkspaceScope(workspaceCode, workspace);
        if (!RUNNING_STATUSES.contains(entity.getStatus())) {
            return responseSupport.toResponse(entity, workspace, responseSupport.collectUserMap(List.of(entity)));
        }
        entity.setUpdatedBy(CurrentUserContext.get());
        markCanceled(entity, "任务已取消，后续步骤不再继续执行。");
        AiGenerationTaskEntity latest = requireTask(taskId);
        return responseSupport.toResponse(latest, workspace, responseSupport.collectUserMap(List.of(latest)));
    }

    public AiGenerationTaskResponse retryTask(String taskId, String workspaceCode) {
        AiGenerationTaskEntity source = requireTask(taskId);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.requireWorkspaceById(source.getWorkspaceId()).getWorkspaceCode()
        );
        validateReadableWorkspaceScope(workspaceCode, workspace);
        if (!"FAILED".equals(source.getStatus())) {
            throw new BadRequestException("Only failed tasks can be retried");
        }

        AiGenerationTaskEntity entity = new AiGenerationTaskEntity();
        LocalDateTime now = LocalDateTime.now();
        Long currentUserId = CurrentUserContext.get();
        entity.setTaskId(generateTaskId());
        entity.setWorkspaceId(source.getWorkspaceId());
        entity.setRequirementTitle(source.getRequirementTitle());
        entity.setRequirementContent(source.getRequirementContent());
        entity.setOutputMode(source.getOutputMode());
        entity.setCaseGenerationLimit(source.getCaseGenerationLimit() == null
                ? AiCaseService.DEFAULT_MAX_CASES
                : source.getCaseGenerationLimit());
        entity.setStatus("PENDING");
        entity.setGenerationStatus("PENDING");
        entity.setReviewStatus("NOT_STARTED");
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setSelfCheckStatus(AiGenerationWorkflowContract.SELF_CHECK_NOT_STARTED);
        entity.setSelfCheckResultJson(null);
        entity.setSelfCheckAttemptCount(0);
        entity.setCurrentStep(1);
        entity.setStepMessage("已创建重试任务，等待重新生成测试用例。");
        entity.setErrorMessage(null);
        entity.setDirectoryId(source.getDirectoryId());
        entity.setDirectoryName(source.getDirectoryName());
        entity.setProvider(null);
        entity.setModel(null);
        entity.setGenerationProvider(null);
        entity.setGenerationModel(null);
        entity.setGenerationPromptVersion(null);
        entity.setGenerationPromptHash(null);
        entity.setGenerationTemperature(null);
        entity.setReviewProvider(null);
        entity.setReviewModel(null);
        entity.setReviewPromptVersion(null);
        entity.setReviewPromptHash(null);
        entity.setReviewTemperature(null);
        entity.setAssetIdsJson(source.getAssetIdsJson());
        entity.setInputMode(source.getInputMode());
        entity.setImageDigest(source.getImageDigest());
        entity.setImageCount(source.getImageCount() == null ? 0 : source.getImageCount());
        entity.setInputTokenCount(null);
        entity.setOutputTokenCount(null);
        entity.setReviewInputTokenCount(null);
        entity.setReviewOutputTokenCount(null);
        entity.setWarningsJson(responseSupport.writeValue(List.of()));
        entity.setInvalidCasesJson(responseSupport.writeValue(List.of()));
        entity.setGeneratedCasesJson(responseSupport.writeValue(List.of()));
        entity.setReviewResultJson(null);
        entity.setGenerationRawOutput(null);
        entity.setReviewRawOutput(null);
        entity.setWarningCodesJson(responseSupport.writeValue(List.of()));
        entity.setHasWarnings(0);
        entity.setTotalReviewBatches(0);
        entity.setCompletedReviewBatches(0);
        entity.setFailedReviewBatches(0);
        entity.setReviewedCaseCount(0);
        entity.setSupplementedCaseCount(0);
        entity.setCoverageCompleteness("UNKNOWN");
        entity.setAdoptedCaseIndexesJson(responseSupport.writeValue(List.of()));
        entity.setDeletedCaseIndexesJson(responseSupport.writeValue(List.of()));
        entity.setSavedCaseCount(0);
        entity.setGeneratedCount(0);
        entity.setCancelRequested(0);
        entity.setSourceTaskId(source.getTaskId());
        entity.setFinishedAt(null);
        entity.setCreatedBy(currentUserId);
        entity.setUpdatedBy(currentUserId);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        aiGenerationTaskMapper.insert(entity);
        appendEvent(entity.getTaskId(), "TASK_RETRIED", "SETUP", "INFO", "已创建重试任务，等待重新生成", null, null, null, null, responseSupport.writeValue(Map.of("sourceTaskId", source.getTaskId())));

        return responseSupport.toResponse(entity, workspace, responseSupport.collectUserMap(List.of(entity)));
    }

    public AiGenerationTaskResponse updateTask(String taskId, String workspaceCode, UpdateAiGenerationTaskRequest request) {
        AiGenerationTaskEntity entity = requireTask(taskId);
        WorkspaceEntity currentWorkspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        validateReadableWorkspaceScope(workspaceCode, currentWorkspace);
        WorkspaceEntity workspace = request.workspaceCode() == null || request.workspaceCode().isBlank()
                ? workspaceService.requireWritableWorkspace(currentWorkspace.getWorkspaceCode())
                : workspaceService.requireWritableWorkspace(request.workspaceCode().trim());
        if (!workspace.getId().equals(entity.getWorkspaceId())) {
            entity.setWorkspaceId(workspace.getId());
        }
        if (request.directoryId() != null) {
            validateDirectory(workspace, request.directoryId());
            entity.setDirectoryId(request.directoryId());
        }
        if (request.directoryName() != null) {
            entity.setDirectoryName(blankToNull(request.directoryName()));
        }
        if (request.generatedCases() != null) {
            candidateService.synchronizeLegacyEdits(entity, request.generatedCases());
            entity.setGeneratedCasesJson(responseSupport.writeValue(request.generatedCases()));
        }
        if (request.adoptedCaseIndexes() != null) {
            entity.setAdoptedCaseIndexesJson(responseSupport.writeValue(responseSupport.normalizeIndexes(request.adoptedCaseIndexes())));
        }
        if (request.deletedCaseIndexes() != null) {
            entity.setDeletedCaseIndexesJson(responseSupport.writeValue(responseSupport.normalizeIndexes(request.deletedCaseIndexes())));
        }
        if (request.savedCaseCount() != null) {
            entity.setSavedCaseCount(Math.max(request.savedCaseCount(), 0));
        }
        entity.setUpdatedBy(CurrentUserContext.get());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        return responseSupport.toResponse(entity, workspace, responseSupport.collectUserMap(List.of(entity)));
    }

    public void deleteTask(String taskId, String workspaceCode) {
        AiGenerationTaskEntity entity = requireTask(taskId);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode()
        );
        validateReadableWorkspaceScope(workspaceCode, workspace);
        aiGenerationTaskMapper.deleteById(entity.getId());
    }

    private void markCanceled(AiGenerationTaskEntity entity, String stepMessage) {
        String previousStatus = entity.getStatus();
        entity.setCancelRequested(1);
        entity.setStatus("CANCELED");
        if ("REVIEWING".equals(previousStatus)) {
            entity.setGenerationStatus("SUCCEEDED");
            entity.setReviewStatus("CANCELED");
        } else {
            entity.setGenerationStatus("CANCELED");
            entity.setReviewStatus("NOT_STARTED");
        }
        entity.setFailedStage(null);
        entity.setErrorCode(null);
        entity.setStepMessage(stepMessage);
        entity.setFinishedAt(entity.getFinishedAt() == null ? LocalDateTime.now() : entity.getFinishedAt());
        entity.setUpdatedAt(LocalDateTime.now());
        aiGenerationTaskMapper.updateById(entity);
        appendEvent(entity.getTaskId(), "TASK_CANCELED", "DONE", "WARN", stepMessage, null, null, entity.getProvider(), entity.getModel(), null);
    }

    private AiGenerationTaskEventResponse appendEvent(
            String taskId,
            String eventType,
            String phase,
            String level,
            String message,
            Integer itemIndex,
            String itemTitle,
            String provider,
            String model,
            String payloadJson
    ) {
        return eventService.append(
                taskId,
                eventType,
                phase,
                level,
                message == null || message.isBlank() ? "-" : message,
                itemIndex,
                itemTitle,
                provider,
                model,
                payloadJson
        );
    }

    private AiGenerationTaskEntity requireTask(String taskId) {
        AiGenerationTaskEntity entity = aiGenerationTaskMapper.selectOne(new LambdaQueryWrapper<AiGenerationTaskEntity>()
                .eq(AiGenerationTaskEntity::getTaskId, taskId)
                .last("limit 1"));
        if (entity == null) {
            throw new BadRequestException("AI generation task does not exist");
        }
        return entity;
    }

    private void validateDirectory(WorkspaceEntity workspace, Long directoryId) {
        if (directoryId == null) {
            return;
        }
        CaseDirectoryEntity entity = caseDirectoryMapper.selectById(directoryId);
        if (entity == null || !entity.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("Case directory does not belong to the target workspace");
        }
    }

    private List<WorkspaceEntity> resolveReadableWorkspaces(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            return workspaceService.listReadableWorkspaceEntities();
        }
        return List.of(workspaceService.requireReadableWorkspace(normalized));
    }

    private void validateReadableWorkspaceScope(String workspaceCode, WorkspaceEntity workspace) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            workspaceService.requireReadableWorkspace(workspace.getWorkspaceCode());
            return;
        }
        if (!normalized.equals(workspace.getWorkspaceCode())) {
            throw new BadRequestException("Task does not belong to the current workspace");
        }
    }

    private String generateTaskId() {
        return "TASK_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private String normalizeOutputMode(String outputMode) {
        return outputMode == null ? "STREAM" : outputMode.trim().toUpperCase(Locale.ROOT);
    }

    private int resolveCaseGenerationLimit() {
        AiCaseConfigEntity config = aiCaseService.requireGeneratorConfig();
        Integer configured = config.getMaxCases();
        if (configured == null) {
            return AiCaseService.DEFAULT_MAX_CASES;
        }
        return Math.max(100, Math.min(configured, AiCaseService.SYSTEM_MAX_CASES));
    }

    private void validateOutputMode(String outputMode) {
        String normalized = normalizeOutputMode(outputMode);
        if (!"STREAM".equals(normalized) && !"COMPLETE".equals(normalized)) {
            throw new BadRequestException("Output mode must be STREAM or COMPLETE");
        }
    }

    private String normalizeRequirementContent(String requirementContent) {
        String normalized = requirementContent == null ? "" : requirementContent.trim();
        if (normalized.length() > MAX_REQUIREMENT_CONTENT_LENGTH) {
            throw new BadRequestException(
                    "需求内容过长，最多支持 " + MAX_REQUIREMENT_CONTENT_LENGTH + " 个字符，请精简后重试"
            );
        }
        return normalized;
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

}
