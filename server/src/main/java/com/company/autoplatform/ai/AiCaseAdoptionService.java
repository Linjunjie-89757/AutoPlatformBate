package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.casecenter.CaseService;
import com.company.autoplatform.casecenter.CreateCaseRequest;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class AiCaseAdoptionService {

    private final AiGenerationTaskMapper taskMapper;
    private final AiCaseAdoptionMapper adoptionMapper;
    private final AiGenerationTaskResponseSupport responseSupport;
    private final WorkspaceService workspaceService;
    private final CaseService caseService;
    private final AiCaseCandidateService candidateService;
    private final TransactionTemplate transactionTemplate;

    public AiCaseAdoptionService(
            AiGenerationTaskMapper taskMapper,
            AiCaseAdoptionMapper adoptionMapper,
            AiGenerationTaskResponseSupport responseSupport,
            WorkspaceService workspaceService,
            CaseService caseService,
            AiCaseCandidateService candidateService,
            PlatformTransactionManager transactionManager
    ) {
        this.taskMapper = taskMapper;
        this.adoptionMapper = adoptionMapper;
        this.responseSupport = responseSupport;
        this.workspaceService = workspaceService;
        this.caseService = caseService;
        this.candidateService = candidateService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public AiCaseAdoptionItem adopt(String taskId, String workspaceCode, Integer caseIndex, AdoptAiCaseRequest request) {
        AiGenerationTaskEntity task = requireTask(taskId);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.requireWorkspaceById(task.getWorkspaceId()).getWorkspaceCode()
        );
        validateWorkspaceScope(workspaceCode, workspace);
        if (caseIndex == null || caseIndex < 0) {
            throw new BadRequestException("用例索引不合法");
        }
        List<GeneratedAiCaseItem> generatedCases = responseSupport.readValue(
                task.getGeneratedCasesJson(), new TypeReference<List<GeneratedAiCaseItem>>() {}, List.of()
        );
        if (caseIndex >= generatedCases.size()) {
            throw new BadRequestException("生成用例不存在");
        }
        candidateService.materializeGeneratedCases(task, generatedCases);
        AiCaseCandidateEntity candidate = candidateService.confirmLegacyAdoption(taskId, caseIndex);
        return adoptCandidate(task, workspace, candidate, request);
    }

    public AiCaseAdoptionItem adoptCandidate(
            String taskId,
            String workspaceCode,
            String candidateId,
            AdoptAiCaseRequest request
    ) {
        AiGenerationTaskEntity task = requireTask(taskId);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.requireWorkspaceById(task.getWorkspaceId()).getWorkspaceCode()
        );
        validateWorkspaceScope(workspaceCode, workspace);
        List<GeneratedAiCaseItem> generatedCases = responseSupport.readValue(
                task.getGeneratedCasesJson(), new TypeReference<List<GeneratedAiCaseItem>>() {}, List.of()
        );
        candidateService.materializeGeneratedCases(task, generatedCases);
        AiCaseCandidateEntity candidate = candidateService.requireForAdoption(taskId, candidateId);
        return adoptCandidate(task, workspace, candidate, request);
    }

    private AiCaseAdoptionItem adoptCandidate(
            AiGenerationTaskEntity task,
            WorkspaceEntity workspace,
            AiCaseCandidateEntity candidate,
            AdoptAiCaseRequest request
    ) {
        if (request == null || request.directoryId() == null) {
            throw new BadRequestException("保存目录不能为空");
        }
        var directory = caseService.requireDirectory(request.directoryId());
        if (!workspace.getId().equals(directory.getWorkspaceId())) {
            throw new BadRequestException("保存目录不属于当前工作空间");
        }
        Long userId = CurrentUserContext.get();
        AiCaseAdoptionEntity prepared = transactionTemplate.execute(status -> prepareAdoption(
                task, candidate, request.directoryId(), userId
        ));
        if (prepared == null) {
            throw new BadRequestException("无法创建采纳记录，请重试");
        }
        if ("ADOPTED".equals(prepared.getStatus())) {
            return toItem(prepared);
        }
        try {
            AiCaseAdoptionItem completed = transactionTemplate.execute(status -> completeAdoption(
                    prepared.getId(), workspace, candidate, request.directoryId(), userId
            ));
            if (completed == null) {
                throw new BadRequestException("采纳事务未完成，请重试");
            }
            return completed;
        } catch (Exception exception) {
            AiCaseAdoptionItem failed = transactionTemplate.execute(status -> markAdoptionFailed(
                    prepared.getId(), candidate, errorMessage(exception), userId
            ));
            if (failed == null) {
                throw new BadRequestException(errorMessage(exception));
            }
            return failed;
        }
    }

    private AiCaseAdoptionEntity prepareAdoption(
            AiGenerationTaskEntity task,
            AiCaseCandidateEntity candidate,
            Long directoryId,
            Long userId
    ) {
        AiCaseAdoptionEntity adoption = adoptionMapper.selectOne(new LambdaQueryWrapper<AiCaseAdoptionEntity>()
                .eq(AiCaseAdoptionEntity::getTaskId, task.getTaskId())
                .eq(AiCaseAdoptionEntity::getCaseIndex, candidate.getDisplayIndex())
                .last("limit 1"));
        if (adoption != null && "ADOPTED".equals(adoption.getStatus())) {
            return adoption;
        }
        LocalDateTime now = LocalDateTime.now();
        if (adoption == null) {
            adoption = new AiCaseAdoptionEntity();
            adoption.setTaskId(task.getTaskId());
            adoption.setCaseIndex(candidate.getDisplayIndex());
            adoption.setAttemptCount(0);
            adoption.setCreatedBy(userId);
            adoption.setCreatedAt(now);
        }
        adoption.setStatus("ADOPTING");
        adoption.setCandidateId(candidate.getCandidateId());
        adoption.setFailureReason(null);
        adoption.setDirectoryId(directoryId);
        adoption.setAdoptedContentVersion(candidate.getContentVersion());
        adoption.setAdoptedContentSource(resolveContentSource(candidate));
        adoption.setIdempotencyKey("AI_CASE_ADOPT:" + task.getTaskId() + ":" + candidate.getCandidateId());
        adoption.setAttemptCount((adoption.getAttemptCount() == null ? 0 : adoption.getAttemptCount()) + 1);
        adoption.setUpdatedBy(userId);
        adoption.setUpdatedAt(now);
        if (adoption.getId() == null) {
            adoptionMapper.insert(adoption);
        } else {
            adoptionMapper.updateById(adoption);
        }
        return adoption;
    }

    private AiCaseAdoptionItem completeAdoption(
            Long adoptionId,
            WorkspaceEntity workspace,
            AiCaseCandidateEntity candidate,
            Long directoryId,
            Long userId
    ) {
        AiCaseAdoptionEntity adoption = adoptionMapper.selectById(adoptionId);
        if (adoption == null) {
            throw new BadRequestException("采纳记录不存在");
        }
        if ("ADOPTED".equals(adoption.getStatus())) {
            return toItem(adoption);
        }
        AiCaseCandidateEntity latestCandidate = candidateService.requireForAdoption(
                adoption.getTaskId(), candidate.getCandidateId()
        );
        if (!latestCandidate.getContentVersion().equals(adoption.getAdoptedContentVersion())) {
            throw new BadRequestException("候选用例在采纳过程中已更新，请重新确认后重试");
        }
        GeneratedAiCaseItem item = candidateService.readCurrentCase(latestCandidate);
        var created = caseService.createCase(workspace.getWorkspaceCode(), new CreateCaseRequest(
                workspace.getWorkspaceCode(),
                directoryId,
                item.title(),
                item.caseType() == null ? "功能测试" : item.caseType(),
                item.priority() == null ? "P2" : item.priority(),
                "AI生成",
                null,
                item.precondition(),
                item.steps(),
                item.expectedResult()
        ));
        adoption.setStatus("ADOPTED");
        adoption.setCreatedCaseId(created.id());
        adoption.setFailureReason(null);
        adoption.setUpdatedBy(userId);
        adoption.setUpdatedAt(LocalDateTime.now());
        adoptionMapper.updateById(adoption);

        AiGenerationTaskEntity latestTask = requireTask(adoption.getTaskId());
        var directory = caseService.requireDirectory(directoryId);
        latestTask.setDirectoryId(directory.getId());
        latestTask.setDirectoryName(directory.getDirectoryName());
        persistTaskIndexes(latestTask, adoption.getCaseIndex());
        candidateService.appendAdoptionAudit(latestCandidate, "ADOPTED", java.util.Map.of(
                "createdCaseId", created.id(),
                "directoryId", directoryId,
                "contentSource", adoption.getAdoptedContentSource()
        ), userId);
        return toItem(adoption);
    }

    private AiCaseAdoptionItem markAdoptionFailed(
            Long adoptionId,
            AiCaseCandidateEntity candidate,
            String failureReason,
            Long userId
    ) {
        AiCaseAdoptionEntity adoption = adoptionMapper.selectById(adoptionId);
        if (adoption == null) {
            throw new BadRequestException("采纳记录不存在");
        }
        adoption.setStatus("ADOPT_FAILED");
        adoption.setFailureReason(failureReason);
        adoption.setUpdatedBy(userId);
        adoption.setUpdatedAt(LocalDateTime.now());
        adoptionMapper.updateById(adoption);
        candidateService.appendAdoptionAudit(candidate, "ADOPT_FAILED", java.util.Map.of(
                "failureReason", failureReason
        ), userId);
        return toItem(adoption);
    }

    public List<AiCaseAdoptionItem> list(String taskId) {
        return adoptionMapper.selectList(new LambdaQueryWrapper<AiCaseAdoptionEntity>()
                        .eq(AiCaseAdoptionEntity::getTaskId, taskId)
                        .orderByAsc(AiCaseAdoptionEntity::getCaseIndex))
                .stream().map(this::toItem).toList();
    }

    private void persistTaskIndexes(AiGenerationTaskEntity task, int index) {
        List<Integer> adopted = new ArrayList<>(responseSupport.readValue(task.getAdoptedCaseIndexesJson(), new TypeReference<List<Integer>>() {}, List.of()));
        if (!adopted.contains(index)) adopted.add(index);
        List<Integer> deleted = new ArrayList<>(responseSupport.readValue(task.getDeletedCaseIndexesJson(), new TypeReference<List<Integer>>() {}, List.of()));
        deleted.removeIf(item -> item == index);
        task.setAdoptedCaseIndexesJson(responseSupport.writeValue(responseSupport.normalizeIndexes(adopted)));
        task.setDeletedCaseIndexesJson(responseSupport.writeValue(responseSupport.normalizeIndexes(deleted)));
        task.setSavedCaseCount(adopted.size());
        task.setUpdatedBy(CurrentUserContext.get());
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);
    }

    private AiGenerationTaskEntity requireTask(String taskId) {
        AiGenerationTaskEntity task = taskMapper.selectOne(new LambdaQueryWrapper<AiGenerationTaskEntity>()
                .eq(AiGenerationTaskEntity::getTaskId, taskId).last("limit 1"));
        if (task == null) throw new BadRequestException("AI generation task does not exist");
        return task;
    }

    private void validateWorkspaceScope(String workspaceCode, WorkspaceEntity workspace) {
        if (workspaceCode != null && !workspaceCode.isBlank() && !"ALL".equalsIgnoreCase(workspaceCode)
                && !workspace.getWorkspaceCode().equalsIgnoreCase(workspaceCode.trim())) {
            throw new BadRequestException("Task does not belong to the current workspace");
        }
    }

    private String errorMessage(Exception exception) {
        return exception.getMessage() == null || exception.getMessage().isBlank() ? "写入用例库失败，请重试" : exception.getMessage();
    }

    private AiCaseAdoptionItem toItem(AiCaseAdoptionEntity item) {
        return new AiCaseAdoptionItem(
                item.getCaseIndex(), item.getStatus(), item.getFailureReason(), item.getDirectoryId(),
                item.getCreatedCaseId(), item.getAttemptCount(), item.getUpdatedAt() == null ? null : item.getUpdatedAt().toString(),
                item.getCandidateId(), item.getAdoptedContentVersion(), item.getAdoptedContentSource(), item.getIdempotencyKey()
        );
    }

    private String resolveContentSource(AiCaseCandidateEntity candidate) {
        return switch (candidate.getHumanDecision()) {
            case "APPLIED_SUGGESTION" -> "AI_SUGGESTED";
            case "MANUAL_EDITED" -> "MANUAL_EDITED";
            case "MERGED" -> "MERGED";
            default -> "ORIGINAL";
        };
    }
}
