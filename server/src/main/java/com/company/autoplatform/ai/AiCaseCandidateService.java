package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AiCaseCandidateService {

    private final AiCaseCandidateMapper candidateMapper;
    private final AiCaseCandidateAuditMapper auditMapper;
    private final AiGenerationTaskMapper taskMapper;
    private final AiCaseAdoptionMapper adoptionMapper;
    private final WorkspaceService workspaceService;
    private final ObjectMapper objectMapper;

    public AiCaseCandidateService(
            AiCaseCandidateMapper candidateMapper,
            AiCaseCandidateAuditMapper auditMapper,
            AiGenerationTaskMapper taskMapper,
            AiCaseAdoptionMapper adoptionMapper,
            WorkspaceService workspaceService,
            ObjectMapper objectMapper
    ) {
        this.candidateMapper = candidateMapper;
        this.auditMapper = auditMapper;
        this.taskMapper = taskMapper;
        this.adoptionMapper = adoptionMapper;
        this.workspaceService = workspaceService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public List<AiCaseCandidateEntity> materializeGeneratedCases(
            AiGenerationTaskEntity task,
            List<GeneratedAiCaseItem> generatedCases
    ) {
        List<AiCaseCandidateEntity> existing = listEntities(task.getTaskId());
        Map<Integer, AiCaseCandidateEntity> existingByIndex = new HashMap<>();
        existing.forEach(item -> existingByIndex.put(item.getDisplayIndex(), item));

        Map<Integer, AiCaseAdoptionEntity> adoptionByIndex = new HashMap<>();
        adoptionMapper.selectList(new LambdaQueryWrapper<AiCaseAdoptionEntity>()
                        .eq(AiCaseAdoptionEntity::getTaskId, task.getTaskId()))
                .forEach(item -> adoptionByIndex.put(item.getCaseIndex(), item));

        LocalDateTime now = LocalDateTime.now();
        for (int index = 0; index < generatedCases.size(); index += 1) {
            if (existingByIndex.containsKey(index)) {
                continue;
            }
            GeneratedAiCaseItem legacyItem = generatedCases.get(index);
            AiCaseAdoptionEntity adoption = adoptionByIndex.get(index);
            boolean adopted = adoption != null && "ADOPTED".equals(adoption.getStatus());
            GeneratedAiCaseItem originalCase = legacyItem.originalCaseSnapshot() == null
                    ? legacyItem
                    : legacyItem.originalCaseSnapshot();
            GeneratedAiCaseItem suggestedCase = legacyItem.originalCaseSnapshot() == null
                    ? null
                    : legacyItem;
            GeneratedAiCaseItem currentCase = adopted ? legacyItem : originalCase;

            AiCaseCandidateEntity candidate = new AiCaseCandidateEntity();
            candidate.setCandidateId(generateCandidateId());
            candidate.setTaskId(task.getTaskId());
            candidate.setDisplayIndex(index);
            candidate.setOrigin(isCoverageReviewSupplement(legacyItem) ? "REVIEW_SUPPLEMENTED" : "GENERATOR");
            candidate.setSourceType(sourceTypeOf(legacyItem));
            candidate.setOriginalCaseJson(writeJson(originalCase));
            candidate.setSuggestedCaseJson(suggestedCase == null ? null : writeJson(suggestedCase));
            candidate.setCurrentCaseJson(writeJson(currentCase));
            candidate.setReviewStatus(normalizeReviewStatus(legacyItem.aiReviewStatus()));
            candidate.setSuggestedAction(inferSuggestedAction(candidate.getReviewStatus(), suggestedCase));
            candidate.setReviewReason(firstNonBlank(
                    legacyItem.aiReviewSummary(),
                    legacyItem.reviewComment(),
                    legacyItem.optimizationReason(),
                    legacyItem.supplementReason()
            ));
            candidate.setMergeTargetCandidateIdsJson(writeJson(List.of()));
            candidate.setHumanDecision(adopted && suggestedCase != null ? "APPLIED_SUGGESTION" : "PENDING");
            candidate.setContentVersion(1);
            candidate.setContentHash(hashCase(currentCase));
            candidate.setValidationStatus(AiGenerationWorkflowContract.VALIDATION_VALID);
            candidate.setCoverageStatus(isSupplement(legacyItem)
                    ? AiGenerationWorkflowContract.COVERAGE_EXPECTED
                    : AiGenerationWorkflowContract.COVERAGE_UNREVIEWED);
            candidate.setVerificationStatus(isSupplement(legacyItem)
                    ? AiGenerationWorkflowContract.VERIFICATION_UNVERIFIED_BY_SECOND_REVIEW
                    : AiGenerationWorkflowContract.VERIFICATION_UNVERIFIED);
            candidate.setSupplementBasis(supplementBasisOf(legacyItem));
            candidate.setSupplementTruncated(0);
            if (suggestedCase != null) {
                candidate.setSuggestionSourceVersion(1);
                candidate.setSuggestionSourceHash(hashCase(originalCase));
            }
            candidate.setCreatedBy(task.getCreatedBy());
            candidate.setUpdatedBy(task.getUpdatedBy());
            candidate.setCreatedAt(task.getCreatedAt() == null ? now : task.getCreatedAt());
            candidate.setUpdatedAt(now);
            candidateMapper.insert(candidate);
            appendAudit(candidate, "MATERIALIZED", null, candidate.getCurrentCaseJson(), Map.of(
                    "legacy", true,
                    "adopted", adopted
            ), task.getUpdatedBy(), null, 1);
            existingByIndex.put(index, candidate);
        }
        return existingByIndex.values().stream()
                .sorted(Comparator.comparing(AiCaseCandidateEntity::getDisplayIndex))
                .toList();
    }

    @Transactional
    public AiCaseCandidateEntity appendSupplement(
            AiGenerationTaskEntity task,
            int displayIndex,
            GeneratedAiCaseItem supplementCase,
            String reviewReason
    ) {
        if (!isValidSupplement(supplementCase)) {
            return null;
        }
        AiCaseCandidateEntity existing = findByTaskAndIndex(task.getTaskId(), displayIndex);
        if (existing != null) {
            return existing;
        }
        if (findDuplicateSupplement(task.getTaskId(), supplementCase) != null) {
            return null;
        }
        LocalDateTime now = LocalDateTime.now();
        AiCaseCandidateEntity candidate = new AiCaseCandidateEntity();
        candidate.setCandidateId(generateCandidateId());
        candidate.setTaskId(task.getTaskId());
        candidate.setDisplayIndex(displayIndex);
        candidate.setOrigin("REVIEW_SUPPLEMENTED");
        candidate.setSourceType(AiGenerationWorkflowContract.SOURCE_COVERAGE_REVIEW_SUPPLEMENT);
        candidate.setOriginalCaseJson(writeJson(supplementCase));
        candidate.setCurrentCaseJson(writeJson(supplementCase));
        candidate.setReviewStatus("CONFIRM_REQUIRED");
        candidate.setSuggestedAction("KEEP");
        candidate.setReviewReason(reviewReason);
        candidate.setMergeTargetCandidateIdsJson(writeJson(List.of()));
        candidate.setHumanDecision("PENDING");
        candidate.setContentVersion(1);
        candidate.setContentHash(hashCase(supplementCase));
        candidate.setValidationStatus(AiGenerationWorkflowContract.VALIDATION_VALID);
        candidate.setCoverageStatus(AiGenerationWorkflowContract.COVERAGE_EXPECTED);
        candidate.setVerificationStatus(AiGenerationWorkflowContract.VERIFICATION_UNVERIFIED_BY_SECOND_REVIEW);
        candidate.setSupplementBasis("COVERAGE_REVIEW");
        candidate.setSupplementTruncated(0);
        candidate.setCreatedBy(task.getCreatedBy());
        candidate.setUpdatedBy(task.getUpdatedBy());
        candidate.setCreatedAt(now);
        candidate.setUpdatedAt(now);
        candidateMapper.insert(candidate);
        appendAudit(candidate, "REVIEW_SUPPLEMENTED", null, candidate.getCurrentCaseJson(), Map.of(), task.getUpdatedBy(), null, 1);
        return candidate;
    }

    @Transactional
    public void synchronizeLegacyEdits(
            AiGenerationTaskEntity task,
            List<GeneratedAiCaseItem> legacyUpdatedCases
    ) {
        List<GeneratedAiCaseItem> previousCases = readCases(task.getGeneratedCasesJson());
        Map<Integer, AiCaseCandidateEntity> candidates = new HashMap<>();
        materializeGeneratedCases(task, previousCases)
                .forEach(item -> candidates.put(item.getDisplayIndex(), item));
        for (int index = 0; index < legacyUpdatedCases.size(); index += 1) {
            GeneratedAiCaseItem updatedCase = legacyUpdatedCases.get(index);
            AiCaseCandidateEntity candidate = candidates.get(index);
            if (candidate == null || !Boolean.TRUE.equals(updatedCase.manualEdited())) {
                continue;
            }
            validateCase(updatedCase);
            String updatedJson = writeJson(updatedCase);
            if (!candidate.getContentHash().equals(hashJson(updatedJson))) {
                updateCurrent(candidate, updatedJson, "MANUAL_EDITED", "LEGACY_MANUALLY_EDITED");
            }
        }
    }

    @Transactional
    public boolean recordReview(
            String taskId,
            String candidateCaseId,
            Integer displayIndex,
            String reviewStatus,
            String suggestedAction,
            Integer score,
            Double confidence,
            String reason,
            GeneratedAiCaseItem suggestedCase,
            List<String> mergeTargetCandidateIds,
            Integer sourceVersion,
            String sourceContentHash
    ) {
        AiCaseCandidateEntity candidate = findReviewTarget(taskId, candidateCaseId, displayIndex);
        if (candidate == null) {
            return false;
        }
        if (isStaleReview(candidate, sourceVersion, sourceContentHash)) {
            appendAudit(candidate, "REVIEW_STALE_IGNORED", candidate.getCurrentCaseJson(), candidate.getCurrentCaseJson(), Map.of(
                    "sourceVersion", sourceVersion == null ? "" : sourceVersion,
                    "sourceContentHash", firstNonBlank(sourceContentHash, ""),
                    "currentVersion", candidate.getContentVersion(),
                    "currentContentHash", firstNonBlank(candidate.getContentHash(), "")
            ), null, candidate.getContentVersion(), candidate.getContentVersion());
            return false;
        }
        String normalizedStatus = normalizeReviewStatus(reviewStatus);
        String normalizedAction = normalizeSuggestedAction(suggestedAction, normalizedStatus, suggestedCase);
        GeneratedAiCaseItem validSuggestion = suggestedCase;
        String normalizedReason = reason;
        if (!isValidReviewCombination(normalizedStatus, normalizedAction)) {
            normalizedStatus = "CONFIRM_REQUIRED";
            normalizedAction = null;
            normalizedReason = firstNonBlank(reason, "AI 评审状态与建议动作组合不合法，需要人工确认");
        }
        if (("MODIFY".equals(normalizedAction) || "MERGE".equals(normalizedAction)) && validSuggestion == null) {
            normalizedStatus = "CONFIRM_REQUIRED";
            normalizedAction = null;
            normalizedReason = firstNonBlank(reason, "AI 建议缺少完整建议稿，需要人工确认");
        }
        List<String> validMergeTargets = validateMergeTargets(
                taskId,
                candidate.getCandidateId(),
                mergeTargetCandidateIds
        );
        if ("MERGE".equals(normalizedAction) && validMergeTargets.isEmpty()) {
            normalizedStatus = "CONFIRM_REQUIRED";
            normalizedAction = null;
            normalizedReason = firstNonBlank(reason, "AI 合并建议缺少有效目标用例，需要人工确认");
        }

        candidate.setReviewStatus(normalizedStatus);
        candidate.setSuggestedAction(normalizedAction);
        candidate.setReviewScore(score != null && score >= 0 && score <= 100 ? score : null);
        candidate.setReviewConfidence(confidence != null && confidence >= 0 && confidence <= 1 ? confidence : null);
        candidate.setReviewReason(normalizedReason);
        candidate.setSuggestedCaseJson(validSuggestion == null ? null : writeJson(validSuggestion));
        candidate.setMergeTargetCandidateIdsJson(writeJson(
                validMergeTargets
        ));
        candidate.setSuggestionSourceVersion(sourceVersion == null ? candidate.getContentVersion() : sourceVersion);
        candidate.setSuggestionSourceHash(firstNonBlank(sourceContentHash, candidate.getContentHash()));
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateMapper.updateById(candidate);
        appendAudit(candidate, "REVIEWED", candidate.getCurrentCaseJson(), candidate.getCurrentCaseJson(), Map.of(
                "reviewStatus", normalizedStatus == null ? "" : normalizedStatus,
                "suggestedAction", normalizedAction == null ? "" : normalizedAction
        ), null, candidate.getContentVersion(), candidate.getContentVersion());
        return true;
    }

    public List<AiCaseCandidateItem> list(String taskId, String workspaceCode) {
        AiGenerationTaskEntity task = requireTask(taskId, workspaceCode, false);
        List<GeneratedAiCaseItem> legacyCases = readCases(task.getGeneratedCasesJson());
        return materializeGeneratedCases(task, legacyCases).stream().map(this::toItem).toList();
    }

    public AiCaseCandidateItem get(String taskId, String candidateId, String workspaceCode) {
        requireTask(taskId, workspaceCode, false);
        return toItem(requireCandidate(taskId, candidateId));
    }

    @Transactional
    public AiCaseCandidateItem keepOriginal(
            String taskId,
            String candidateId,
            String workspaceCode,
            AiCaseCandidateVersionRequest request
    ) {
        requireWritableTask(taskId, workspaceCode);
        AiCaseCandidateEntity candidate = requireVersion(requireCandidate(taskId, candidateId), request.expectedVersion(), request.expectedContentHash());
        return updateCurrent(candidate, candidate.getOriginalCaseJson(), "KEEP_ORIGINAL", "ORIGINAL_KEPT");
    }

    @Transactional
    public AiCaseCandidateItem applySuggestion(
            String taskId,
            String candidateId,
            String workspaceCode,
            AiCaseCandidateVersionRequest request
    ) {
        requireWritableTask(taskId, workspaceCode);
        AiCaseCandidateEntity candidate = requireVersion(requireCandidate(taskId, candidateId), request.expectedVersion(), request.expectedContentHash());
        if (candidate.getSuggestedCaseJson() == null || candidate.getSuggestedCaseJson().isBlank()) {
            throw new BadRequestException("当前候选用例没有可应用的 AI 建议");
        }
        if (!candidate.getContentVersion().equals(candidate.getSuggestionSourceVersion())
                || !candidate.getContentHash().equals(candidate.getSuggestionSourceHash())) {
            throw new BadRequestException("该 AI 建议基于旧版本生成，已不可直接应用，请重新评审");
        }
        return updateCurrent(candidate, candidate.getSuggestedCaseJson(), "APPLIED_SUGGESTION", "SUGGESTION_APPLIED");
    }

    @Transactional
    public AiCaseCandidateItem resetVersionChoice(
            String taskId,
            String candidateId,
            String workspaceCode,
            AiCaseCandidateVersionRequest request
    ) {
        requireWritableTask(taskId, workspaceCode);
        AiCaseCandidateEntity candidate = requireVersion(requireCandidate(taskId, candidateId), request.expectedVersion(), request.expectedContentHash());
        if (!"APPLIED_SUGGESTION".equals(candidate.getHumanDecision())
                && !"KEEP_ORIGINAL".equals(candidate.getHumanDecision())) {
            throw new BadRequestException("当前候选用例没有可撤销的版本选择");
        }
        AiCaseAdoptionEntity adoption = adoptionMapper.selectOne(new LambdaQueryWrapper<AiCaseAdoptionEntity>()
                .eq(AiCaseAdoptionEntity::getTaskId, taskId)
                .eq(AiCaseAdoptionEntity::getCaseIndex, candidate.getDisplayIndex())
                .last("limit 1"));
        if (adoption != null && ("ADOPTING".equals(adoption.getStatus()) || "ADOPTED".equals(adoption.getStatus()))) {
            throw new BadRequestException("用例正在采纳或已采纳，不能撤销版本选择");
        }
        return resetToPendingOriginal(candidate);
    }

    @Transactional
    public AiCaseCandidateItem updateCurrentCase(
            String taskId,
            String candidateId,
            String workspaceCode,
            UpdateAiCaseCandidateRequest request
    ) {
        requireWritableTask(taskId, workspaceCode);
        AiCaseCandidateEntity candidate = requireVersion(requireCandidate(taskId, candidateId), request.expectedVersion(), request.expectedContentHash());
        validateCase(request.currentCase());
        return updateCurrent(candidate, writeJson(request.currentCase()), "MANUAL_EDITED", "MANUALLY_EDITED");
    }

    @Transactional
    public AiCaseCandidateItem exclude(
            String taskId,
            String candidateId,
            String workspaceCode,
            AiCaseCandidateVersionRequest request
    ) {
        requireWritableTask(taskId, workspaceCode);
        AiCaseCandidateEntity candidate = requireVersion(requireCandidate(taskId, candidateId), request.expectedVersion(), request.expectedContentHash());
        return updateDecision(candidate, "EXCLUDED", "EXCLUDED");
    }

    @Transactional
    public AiCaseCandidateItem restore(
            String taskId,
            String candidateId,
            String workspaceCode,
            AiCaseCandidateVersionRequest request
    ) {
        requireWritableTask(taskId, workspaceCode);
        AiCaseCandidateEntity candidate = requireVersion(requireCandidate(taskId, candidateId), request.expectedVersion(), request.expectedContentHash());
        if (!"EXCLUDED".equals(candidate.getHumanDecision())) {
            throw new BadRequestException("只有已放弃的候选用例可以恢复");
        }
        return updateDecision(candidate, "PENDING", "RESTORED");
    }

    AiExistingCaseItem toReviewItem(AiCaseCandidateEntity candidate) {
        GeneratedAiCaseItem current = readCase(candidate.getCurrentCaseJson());
        return new AiExistingCaseItem(
                candidate.getCandidateId(),
                candidate.getContentVersion(),
                candidate.getContentHash(),
                current.title(),
                current.caseType(),
                current.priority(),
                current.precondition(),
                current.steps(),
                current.expectedResult(),
                current.testAngle(),
                current.generationReason(),
                current.requirementEvidence()
        );
    }

    List<AiCaseCandidateEntity> listEntities(String taskId) {
        return candidateMapper.selectList(new LambdaQueryWrapper<AiCaseCandidateEntity>()
                .eq(AiCaseCandidateEntity::getTaskId, taskId)
                .orderByAsc(AiCaseCandidateEntity::getDisplayIndex));
    }

    AiCaseCandidateEntity requireForAdoption(String taskId, Integer displayIndex) {
        AiCaseCandidateEntity candidate = findByTaskAndIndex(taskId, displayIndex);
        if (candidate == null) {
            throw new BadRequestException("候选用例不存在");
        }
        validateAdoptable(candidate);
        return candidate;
    }

    AiCaseCandidateEntity confirmLegacyAdoption(String taskId, Integer displayIndex) {
        AiCaseCandidateEntity candidate = findByTaskAndIndex(taskId, displayIndex);
        if (candidate == null) {
            throw new BadRequestException("候选用例不存在");
        }
        if ("EXCLUDED".equals(candidate.getHumanDecision()) || "MERGED".equals(candidate.getHumanDecision())) {
            throw new BadRequestException("已放弃或已合并的候选用例不能采纳");
        }
        if ("PENDING".equals(candidate.getHumanDecision()) && !"APPROVED".equals(candidate.getReviewStatus())) {
            int fromVersion = candidate.getContentVersion();
            String expectedHash = candidate.getContentHash();
            candidate.setHumanDecision("KEEP_ORIGINAL");
            candidate.setContentVersion(fromVersion + 1);
            candidate.setUpdatedBy(CurrentUserContext.get());
            candidate.setUpdatedAt(LocalDateTime.now());
            int updated = candidateMapper.update(null, new LambdaUpdateWrapper<AiCaseCandidateEntity>()
                    .eq(AiCaseCandidateEntity::getId, candidate.getId())
                    .eq(AiCaseCandidateEntity::getContentVersion, fromVersion)
                    .eq(AiCaseCandidateEntity::getContentHash, expectedHash)
                    .set(AiCaseCandidateEntity::getHumanDecision, candidate.getHumanDecision())
                    .set(AiCaseCandidateEntity::getContentVersion, candidate.getContentVersion())
                    .set(AiCaseCandidateEntity::getUpdatedBy, candidate.getUpdatedBy())
                    .set(AiCaseCandidateEntity::getUpdatedAt, candidate.getUpdatedAt()));
            requireUpdated(updated);
            appendAudit(
                    candidate,
                    "ORIGINAL_KEPT_BY_LEGACY_ADOPTION",
                    candidate.getCurrentCaseJson(),
                    candidate.getCurrentCaseJson(),
                    Map.of("compatibilityEndpoint", true),
                    candidate.getUpdatedBy(),
                    fromVersion,
                    candidate.getContentVersion()
            );
        }
        return candidate;
    }

    AiCaseCandidateEntity requireForAdoption(String taskId, String candidateId) {
        AiCaseCandidateEntity candidate = requireCandidate(taskId, candidateId);
        validateAdoptable(candidate);
        return candidate;
    }

    GeneratedAiCaseItem readCurrentCase(AiCaseCandidateEntity candidate) {
        return readCase(candidate.getCurrentCaseJson());
    }

    void validateCurrentCaseForAdoption(AiCaseCandidateEntity candidate) {
        validateCase(readCurrentCase(candidate));
    }

    void appendAdoptionAudit(AiCaseCandidateEntity candidate, String action, Map<String, Object> metadata, Long operatorId) {
        appendAudit(
                candidate,
                action,
                candidate.getCurrentCaseJson(),
                candidate.getCurrentCaseJson(),
                metadata,
                operatorId,
                candidate.getContentVersion(),
                candidate.getContentVersion()
        );
    }

    private AiCaseCandidateItem updateCurrent(
            AiCaseCandidateEntity candidate,
            String nextCaseJson,
            String humanDecision,
            String auditAction
    ) {
        String before = candidate.getCurrentCaseJson();
        int fromVersion = candidate.getContentVersion();
        String expectedHash = candidate.getContentHash();
        int toVersion = fromVersion + 1;
        candidate.setCurrentCaseJson(nextCaseJson);
        candidate.setContentVersion(toVersion);
        candidate.setContentHash(hashJson(nextCaseJson));
        candidate.setHumanDecision(humanDecision);
        candidate.setUpdatedBy(CurrentUserContext.get());
        candidate.setUpdatedAt(LocalDateTime.now());
        int updated = candidateMapper.update(null, new LambdaUpdateWrapper<AiCaseCandidateEntity>()
                .eq(AiCaseCandidateEntity::getId, candidate.getId())
                .eq(AiCaseCandidateEntity::getContentVersion, fromVersion)
                .eq(AiCaseCandidateEntity::getContentHash, expectedHash)
                .set(AiCaseCandidateEntity::getCurrentCaseJson, candidate.getCurrentCaseJson())
                .set(AiCaseCandidateEntity::getContentVersion, candidate.getContentVersion())
                .set(AiCaseCandidateEntity::getContentHash, candidate.getContentHash())
                .set(AiCaseCandidateEntity::getHumanDecision, candidate.getHumanDecision())
                .set(AiCaseCandidateEntity::getUpdatedBy, candidate.getUpdatedBy())
                .set(AiCaseCandidateEntity::getUpdatedAt, candidate.getUpdatedAt()));
        requireUpdated(updated);
        appendAudit(candidate, auditAction, before, nextCaseJson, Map.of(), candidate.getUpdatedBy(), fromVersion, toVersion);
        return toItem(candidate);
    }

    private AiCaseCandidateItem updateDecision(
            AiCaseCandidateEntity candidate,
            String humanDecision,
            String auditAction
    ) {
        int fromVersion = candidate.getContentVersion();
        String expectedHash = candidate.getContentHash();
        int toVersion = fromVersion + 1;
        candidate.setHumanDecision(humanDecision);
        candidate.setContentVersion(toVersion);
        candidate.setUpdatedBy(CurrentUserContext.get());
        candidate.setUpdatedAt(LocalDateTime.now());
        int updated = candidateMapper.update(null, new LambdaUpdateWrapper<AiCaseCandidateEntity>()
                .eq(AiCaseCandidateEntity::getId, candidate.getId())
                .eq(AiCaseCandidateEntity::getContentVersion, fromVersion)
                .eq(AiCaseCandidateEntity::getContentHash, expectedHash)
                .set(AiCaseCandidateEntity::getHumanDecision, candidate.getHumanDecision())
                .set(AiCaseCandidateEntity::getContentVersion, candidate.getContentVersion())
                .set(AiCaseCandidateEntity::getUpdatedBy, candidate.getUpdatedBy())
                .set(AiCaseCandidateEntity::getUpdatedAt, candidate.getUpdatedAt()));
        requireUpdated(updated);
        appendAudit(candidate, auditAction, candidate.getCurrentCaseJson(), candidate.getCurrentCaseJson(), Map.of(), candidate.getUpdatedBy(), fromVersion, toVersion);
        return toItem(candidate);
    }

    private AiCaseCandidateItem resetToPendingOriginal(AiCaseCandidateEntity candidate) {
        String before = candidate.getCurrentCaseJson();
        int fromVersion = candidate.getContentVersion();
        String expectedHash = candidate.getContentHash();
        int toVersion = fromVersion + 1;
        String originalCaseJson = candidate.getOriginalCaseJson();
        String originalHash = hashJson(originalCaseJson);
        candidate.setCurrentCaseJson(originalCaseJson);
        candidate.setContentVersion(toVersion);
        candidate.setContentHash(originalHash);
        candidate.setHumanDecision("PENDING");
        candidate.setSuggestionSourceVersion(candidate.getSuggestedCaseJson() == null ? null : toVersion);
        candidate.setSuggestionSourceHash(candidate.getSuggestedCaseJson() == null ? null : originalHash);
        candidate.setUpdatedBy(CurrentUserContext.get());
        candidate.setUpdatedAt(LocalDateTime.now());
        int updated = candidateMapper.update(null, new LambdaUpdateWrapper<AiCaseCandidateEntity>()
                .eq(AiCaseCandidateEntity::getId, candidate.getId())
                .eq(AiCaseCandidateEntity::getContentVersion, fromVersion)
                .eq(AiCaseCandidateEntity::getContentHash, expectedHash)
                .set(AiCaseCandidateEntity::getCurrentCaseJson, candidate.getCurrentCaseJson())
                .set(AiCaseCandidateEntity::getContentVersion, candidate.getContentVersion())
                .set(AiCaseCandidateEntity::getContentHash, candidate.getContentHash())
                .set(AiCaseCandidateEntity::getHumanDecision, candidate.getHumanDecision())
                .set(AiCaseCandidateEntity::getSuggestionSourceVersion, candidate.getSuggestionSourceVersion())
                .set(AiCaseCandidateEntity::getSuggestionSourceHash, candidate.getSuggestionSourceHash())
                .set(AiCaseCandidateEntity::getUpdatedBy, candidate.getUpdatedBy())
                .set(AiCaseCandidateEntity::getUpdatedAt, candidate.getUpdatedAt()));
        requireUpdated(updated);
        appendAudit(candidate, "VERSION_CHOICE_RESET", before, originalCaseJson, Map.of(), candidate.getUpdatedBy(), fromVersion, toVersion);
        return toItem(candidate);
    }

    private AiCaseCandidateEntity requireVersion(
            AiCaseCandidateEntity candidate,
            Integer expectedVersion,
            String expectedHash
    ) {
        if (!candidate.getContentVersion().equals(expectedVersion)
                || !candidate.getContentHash().equalsIgnoreCase(expectedHash.trim())) {
            throw new BadRequestException("候选用例已被其他操作更新，请刷新后重试");
        }
        return candidate;
    }

    private void requireUpdated(int updated) {
        if (updated != 1) {
            throw new BadRequestException("候选用例已被其他操作更新，请刷新后重试");
        }
    }

    private void validateAdoptable(AiCaseCandidateEntity candidate) {
        if (AiGenerationWorkflowContract.VALIDATION_FAILED.equals(candidate.getValidationStatus())) {
            throw new BadRequestException("校验失败的候选用例不能直接采纳，请修改后重新校验");
        }
        if (AiGenerationWorkflowContract.VALIDATION_DUPLICATE.equals(candidate.getValidationStatus())) {
            throw new BadRequestException("重复候选用例不能直接采纳");
        }
        if ("EXCLUDED".equals(candidate.getHumanDecision()) || "MERGED".equals(candidate.getHumanDecision())) {
            throw new BadRequestException("已放弃或已合并的候选用例不能采纳");
        }
        if ("PENDING".equals(candidate.getHumanDecision()) && !"APPROVED".equals(candidate.getReviewStatus())) {
            throw new BadRequestException("该候选用例仍需人工确认后才能采纳");
        }
    }

    private AiCaseCandidateEntity findReviewTarget(String taskId, String candidateCaseId, Integer displayIndex) {
        if (candidateCaseId != null && !candidateCaseId.isBlank()) {
            AiCaseCandidateEntity candidate = candidateMapper.selectOne(new LambdaQueryWrapper<AiCaseCandidateEntity>()
                    .eq(AiCaseCandidateEntity::getTaskId, taskId)
                    .eq(AiCaseCandidateEntity::getCandidateId, candidateCaseId.trim())
                    .last("limit 1"));
            if (candidate == null) {
                return null;
            }
            if (displayIndex != null && !displayIndex.equals(candidate.getDisplayIndex())) {
                appendAudit(candidate, "REVIEW_TARGET_MISMATCH_IGNORED", candidate.getCurrentCaseJson(), candidate.getCurrentCaseJson(), Map.of(
                        "returnedDisplayIndex", displayIndex,
                        "currentDisplayIndex", candidate.getDisplayIndex()
                ), null, candidate.getContentVersion(), candidate.getContentVersion());
                return null;
            }
            return candidate;
        }
        return findByTaskAndIndex(taskId, displayIndex);
    }

    private AiCaseCandidateEntity requireCandidate(String taskId, String candidateId) {
        AiCaseCandidateEntity candidate = candidateMapper.selectOne(new LambdaQueryWrapper<AiCaseCandidateEntity>()
                .eq(AiCaseCandidateEntity::getTaskId, taskId)
                .eq(AiCaseCandidateEntity::getCandidateId, candidateId)
                .last("limit 1"));
        if (candidate == null) {
            throw new BadRequestException("候选用例不存在");
        }
        return candidate;
    }

    private AiCaseCandidateEntity findByTaskAndIndex(String taskId, Integer displayIndex) {
        if (displayIndex == null || displayIndex < 0) {
            return null;
        }
        return candidateMapper.selectOne(new LambdaQueryWrapper<AiCaseCandidateEntity>()
                .eq(AiCaseCandidateEntity::getTaskId, taskId)
                .eq(AiCaseCandidateEntity::getDisplayIndex, displayIndex)
                .last("limit 1"));
    }

    private AiGenerationTaskEntity requireWritableTask(String taskId, String workspaceCode) {
        return requireTask(taskId, workspaceCode, true);
    }

    private AiGenerationTaskEntity requireTask(String taskId, String workspaceCode, boolean writable) {
        AiGenerationTaskEntity task = taskMapper.selectOne(new LambdaQueryWrapper<AiGenerationTaskEntity>()
                .eq(AiGenerationTaskEntity::getTaskId, taskId)
                .last("limit 1"));
        if (task == null) {
            throw new BadRequestException("AI generation task does not exist");
        }
        String taskWorkspaceCode = workspaceService.requireWorkspaceById(task.getWorkspaceId()).getWorkspaceCode();
        WorkspaceEntity workspace = writable
                ? workspaceService.requireWritableWorkspace(taskWorkspaceCode)
                : workspaceService.requireReadableWorkspace(taskWorkspaceCode);
        if (workspaceCode != null && !workspaceCode.isBlank() && !"ALL".equalsIgnoreCase(workspaceCode)
                && !workspace.getWorkspaceCode().equalsIgnoreCase(workspaceCode.trim())) {
            throw new BadRequestException("Task does not belong to the current workspace");
        }
        return task;
    }

    private AiCaseCandidateItem toItem(AiCaseCandidateEntity entity) {
        return new AiCaseCandidateItem(
                entity.getCandidateId(),
                entity.getDisplayIndex(),
                entity.getOrigin(),
                entity.getSourceType(),
                readCase(entity.getOriginalCaseJson()),
                readCaseNullable(entity.getSuggestedCaseJson()),
                readCase(entity.getCurrentCaseJson()),
                entity.getReviewStatus(),
                entity.getSuggestedAction(),
                entity.getReviewScore(),
                entity.getReviewConfidence(),
                entity.getReviewReason(),
                readStringList(entity.getMergeTargetCandidateIdsJson()),
                entity.getHumanDecision(),
                entity.getContentVersion(),
                entity.getContentHash(),
                entity.getValidationStatus(),
                readStringList(entity.getValidationIssuesJson()),
                entity.getDuplicateOfCandidateId(),
                entity.getCoverageStatus(),
                entity.getVerificationStatus(),
                entity.getSupplementBasis(),
                entity.getSupplementTruncated() != null && entity.getSupplementTruncated() == 1,
                entity.getSuggestionSourceVersion(),
                entity.getSuggestionSourceHash(),
                entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString(),
                entity.getUpdatedAt() == null ? null : entity.getUpdatedAt().toString()
        );
    }

    private void appendAudit(
            AiCaseCandidateEntity candidate,
            String action,
            String beforeJson,
            String afterJson,
            Map<String, Object> metadata,
            Long operatorId,
            Integer fromVersion,
            Integer toVersion
    ) {
        LocalDateTime now = LocalDateTime.now();
        AiCaseCandidateAuditEntity audit = new AiCaseCandidateAuditEntity();
        audit.setCandidateId(candidate.getCandidateId());
        audit.setTaskId(candidate.getTaskId());
        audit.setActionType(action);
        audit.setFromVersion(fromVersion);
        audit.setToVersion(toVersion);
        audit.setBeforeCaseJson(beforeJson);
        audit.setAfterCaseJson(afterJson);
        audit.setMetadataJson(writeJson(metadata));
        audit.setOperatorId(operatorId);
        audit.setCreatedAt(now);
        audit.setUpdatedAt(now);
        auditMapper.insert(audit);
    }

    private void validateCase(GeneratedAiCaseItem item) {
        if (item == null || isBlank(item.title()) || isBlank(item.steps()) || isBlank(item.expectedResult())) {
            throw new BadRequestException("用例标题、步骤和预期结果不能为空");
        }
    }

    private boolean isValidSupplement(GeneratedAiCaseItem item) {
        if (item == null || isBlank(item.title()) || isBlank(item.steps()) || isBlank(item.expectedResult())) {
            return false;
        }
        return isSupportedCaseType(item.caseType()) && isSupportedPriority(item.priority());
    }

    private boolean isSupportedCaseType(String value) {
        return value == null || List.of("FUNCTION", "BOUNDARY", "EXCEPTION", "REGRESSION")
                .contains(value.trim().toUpperCase(Locale.ROOT));
    }

    private boolean isSupportedPriority(String value) {
        return value == null || List.of("P0", "P1", "P2", "P3")
                .contains(value.trim().toUpperCase(Locale.ROOT));
    }

    private AiCaseCandidateEntity findDuplicateSupplement(String taskId, GeneratedAiCaseItem supplementCase) {
        String fingerprint = hashCaseCore(supplementCase);
        for (AiCaseCandidateEntity candidate : listEntities(taskId)) {
            if (matchesCaseFingerprint(candidate.getCurrentCaseJson(), fingerprint)
                    || matchesCaseFingerprint(candidate.getOriginalCaseJson(), fingerprint)
                    || matchesCaseFingerprint(candidate.getSuggestedCaseJson(), fingerprint)) {
                return candidate;
            }
        }
        return null;
    }

    private boolean matchesCaseFingerprint(String rawCase, String fingerprint) {
        GeneratedAiCaseItem item = readCaseNullable(rawCase);
        return item != null && hashCaseCore(item).equals(fingerprint);
    }

    private String hashCaseCore(GeneratedAiCaseItem item) {
        return hashJson(writeJson(List.of(
                normalizeFingerprintValue(item.title()),
                normalizeFingerprintValue(item.precondition()),
                normalizeFingerprintValue(item.steps()),
                normalizeFingerprintValue(item.expectedResult())
        )));
    }

    private String normalizeFingerprintValue(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isStaleReview(AiCaseCandidateEntity candidate, Integer sourceVersion, String sourceContentHash) {
        boolean versionMismatch = sourceVersion != null && !sourceVersion.equals(candidate.getContentVersion());
        boolean hashMismatch = sourceContentHash != null && !sourceContentHash.isBlank()
                && !sourceContentHash.trim().equalsIgnoreCase(candidate.getContentHash());
        return versionMismatch || hashMismatch;
    }

    private List<GeneratedAiCaseItem> readCases(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<List<GeneratedAiCaseItem>>() {});
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("历史 AI 用例数据无法解析");
        }
    }

    private GeneratedAiCaseItem readCase(String raw) {
        GeneratedAiCaseItem item = readCaseNullable(raw);
        if (item == null) {
            throw new BadRequestException("候选用例内容不存在");
        }
        return item;
    }

    private GeneratedAiCaseItem readCaseNullable(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, GeneratedAiCaseItem.class);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("候选用例内容无法解析");
        }
    }

    private List<String> readStringList(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException exception) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("候选用例数据无法序列化");
        }
    }

    private String hashCase(GeneratedAiCaseItem item) {
        return hashJson(writeJson(item));
    }

    private String hashJson(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private String generateCandidateId() {
        return "AIC_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase(Locale.ROOT);
    }

    private boolean isSupplement(GeneratedAiCaseItem item) {
        return item != null && ("REVIEW_SUPPLEMENTED".equals(item.aiSource())
                || "SELF_REVIEW_SUPPLEMENT".equals(item.aiSource())
                || "SUPPLEMENTED".equals(item.aiReviewStatus()));
    }

    private boolean isCoverageReviewSupplement(GeneratedAiCaseItem item) {
        return item != null && ("REVIEW_SUPPLEMENTED".equals(item.aiSource())
                || "SUPPLEMENTED".equals(item.aiReviewStatus()));
    }

    private String sourceTypeOf(GeneratedAiCaseItem item) {
        if (item != null && "SELF_REVIEW_SUPPLEMENT".equals(item.aiSource())) {
            return AiGenerationWorkflowContract.SOURCE_SELF_REVIEW_SUPPLEMENT;
        }
        if (isCoverageReviewSupplement(item)) {
            return AiGenerationWorkflowContract.SOURCE_COVERAGE_REVIEW_SUPPLEMENT;
        }
        return AiGenerationWorkflowContract.SOURCE_INITIAL_GENERATION;
    }

    private String supplementBasisOf(GeneratedAiCaseItem item) {
        if (item != null && "SELF_REVIEW_SUPPLEMENT".equals(item.aiSource())) {
            return "SELF_REVIEW";
        }
        return isCoverageReviewSupplement(item) ? "LEGACY_REVIEW_RESULT" : null;
    }

    private String normalizeReviewStatus(String status) {
        if (status == null || status.isBlank() || "PENDING_REVIEW".equals(status)) {
            return null;
        }
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "OPTIMIZED" -> "CHANGE_SUGGESTED";
            case "SUPPLEMENTED" -> "CONFIRM_REQUIRED";
            case "APPROVED", "CHANGE_SUGGESTED", "CONFIRM_REQUIRED", "NOT_RECOMMENDED" -> status.trim().toUpperCase(Locale.ROOT);
            default -> "CONFIRM_REQUIRED";
        };
    }

    private String normalizeSuggestedAction(
            String action,
            String reviewStatus,
            GeneratedAiCaseItem suggestedCase
    ) {
        if (action != null && !action.isBlank()) {
            String normalized = action.trim().toUpperCase(Locale.ROOT);
            if (List.of("KEEP", "MODIFY", "EXCLUDE", "MERGE").contains(normalized)) {
                return normalized;
            }
        }
        return inferSuggestedAction(reviewStatus, suggestedCase);
    }

    private String inferSuggestedAction(String reviewStatus, GeneratedAiCaseItem suggestedCase) {
        if ("APPROVED".equals(reviewStatus)) {
            return "KEEP";
        }
        if ("CHANGE_SUGGESTED".equals(reviewStatus) && suggestedCase != null) {
            return "MODIFY";
        }
        if ("NOT_RECOMMENDED".equals(reviewStatus)) {
            return "EXCLUDE";
        }
        return null;
    }

    private boolean isValidReviewCombination(String reviewStatus, String suggestedAction) {
        if (reviewStatus == null) {
            return suggestedAction == null;
        }
        return switch (reviewStatus) {
            case "APPROVED" -> "KEEP".equals(suggestedAction);
            case "CHANGE_SUGGESTED" -> "MODIFY".equals(suggestedAction);
            case "NOT_RECOMMENDED" -> "EXCLUDE".equals(suggestedAction);
            case "CONFIRM_REQUIRED" -> true;
            default -> false;
        };
    }

    private List<String> validateMergeTargets(
            String taskId,
            String candidateId,
            List<String> requestedTargets
    ) {
        if (requestedTargets == null || requestedTargets.isEmpty()) {
            return List.of();
        }
        List<String> normalized = requestedTargets.stream()
                .filter(item -> item != null && !item.isBlank())
                .map(String::trim)
                .filter(item -> !item.equals(candidateId))
                .distinct()
                .toList();
        if (normalized.isEmpty()) {
            return List.of();
        }
        List<String> existingIds = candidateMapper.selectList(new LambdaQueryWrapper<AiCaseCandidateEntity>()
                        .eq(AiCaseCandidateEntity::getTaskId, taskId)
                        .in(AiCaseCandidateEntity::getCandidateId, normalized))
                .stream()
                .map(AiCaseCandidateEntity::getCandidateId)
                .toList();
        return existingIds.size() == normalized.size() ? normalized : List.of();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
