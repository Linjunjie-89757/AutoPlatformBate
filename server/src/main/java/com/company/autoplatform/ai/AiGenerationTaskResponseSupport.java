package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Component
public class AiGenerationTaskResponseSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final AiGenerationTaskEventService eventService;
    private final UserService userService;
    private final AiCaseAdoptionMapper adoptionMapper;

    public AiGenerationTaskResponseSupport(
            AiGenerationTaskEventService eventService,
            UserService userService,
            AiCaseAdoptionMapper adoptionMapper
    ) {
        this.eventService = eventService;
        this.userService = userService;
        this.adoptionMapper = adoptionMapper;
    }

    String writeValue(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Failed to serialize AI generation task data");
        }
    }

    <T> T readValue(String raw, TypeReference<T> typeReference, T fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return OBJECT_MAPPER.readValue(raw, typeReference);
        } catch (JsonProcessingException exception) {
            return fallback;
        }
    }

    List<Integer> normalizeIndexes(List<Integer> indexes) {
        return indexes == null ? List.of() : indexes.stream()
                .filter(item -> item != null && item >= 0)
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    AiGenerationTaskResponse toResponse(AiGenerationTaskEntity entity, WorkspaceEntity workspace, Map<Long, UserEntity> userMap) {
        return toResponse(entity, workspace, userMap, true);
    }

    AiGenerationTaskResponse toResponse(AiGenerationTaskEntity entity, WorkspaceEntity workspace, Map<Long, UserEntity> userMap, boolean includeEvents) {
        UserEntity creator = entity.getCreatedBy() == null ? null : userMap.get(entity.getCreatedBy());
        UserEntity updater = entity.getUpdatedBy() == null ? null : userMap.get(entity.getUpdatedBy());
        return new AiGenerationTaskResponse(
                entity.getTaskId(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getRequirementTitle(),
                entity.getRequirementContent(),
                entity.getOutputMode(),
                entity.getStatus(),
                entity.getGenerationStatus(),
                entity.getReviewStatus(),
                entity.getFailedStage(),
                entity.getErrorCode(),
                entity.getCurrentStep(),
                entity.getStepMessage(),
                entity.getErrorMessage(),
                entity.getDirectoryId(),
                entity.getDirectoryName(),
                creator == null ? null : creator.getDisplayName(),
                updater == null ? null : updater.getDisplayName(),
                entity.getProvider(),
                entity.getModel(),
                entity.getGeneratedCount() == null ? 0 : entity.getGeneratedCount(),
                entity.getSavedCaseCount() == null ? 0 : entity.getSavedCaseCount(),
                readValue(entity.getWarningsJson(), new TypeReference<List<String>>() {}, List.of()),
                readValue(entity.getInvalidCasesJson(), new TypeReference<List<AiInvalidCaseItem>>() {}, List.of()),
                readValue(entity.getGeneratedCasesJson(), new TypeReference<List<GeneratedAiCaseItem>>() {}, List.of()),
                readReviewResult(entity.getReviewResultJson()),
                entity.getGenerationRawOutput(),
                entity.getReviewRawOutput(),
                includeEvents ? eventService.list(entity.getTaskId()) : List.of(),
                readValue(entity.getAdoptedCaseIndexesJson(), new TypeReference<List<Integer>>() {}, List.of()),
                readValue(entity.getDeletedCaseIndexesJson(), new TypeReference<List<Integer>>() {}, List.of()),
                adoptionMapper.selectList(new LambdaQueryWrapper<AiCaseAdoptionEntity>()
                        .eq(AiCaseAdoptionEntity::getTaskId, entity.getTaskId())
                        .orderByAsc(AiCaseAdoptionEntity::getCaseIndex)
                ).stream().map(item -> new AiCaseAdoptionItem(
                        item.getCaseIndex(), item.getStatus(), item.getFailureReason(), item.getDirectoryId(),
                        item.getCreatedCaseId(), item.getAttemptCount(),
                        item.getUpdatedAt() == null ? null : item.getUpdatedAt().toString(),
                        item.getCandidateId(), item.getAdoptedContentVersion(), item.getAdoptedContentSource(), item.getIdempotencyKey()
                )).toList(),
                entity.getCancelRequested() != null && entity.getCancelRequested() == 1,
                entity.getSourceTaskId(),
                entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString(),
                entity.getUpdatedAt() == null ? null : entity.getUpdatedAt().toString(),
                entity.getFinishedAt() == null ? null : entity.getFinishedAt().toString()
        );
    }

    Map<Long, UserEntity> collectUserMap(List<AiGenerationTaskEntity> entities) {
        return entities.stream()
                .flatMap(item -> Stream.of(item.getCreatedBy(), item.getUpdatedBy()))
                .filter(id -> id != null && id > 0)
                .distinct()
                .map(userService::requireUser)
                .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    }

    private AiReviewResult readReviewResult(String raw) {
        return readValue(raw, new TypeReference<AiReviewResult>() {}, null);
    }
}
