package com.company.autoplatform.bug;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.JsonUtils;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
public class BugResponseAssembler {

    private final BugAttachmentSupport bugAttachmentSupport;
    private final BugSourceContextSupport bugSourceContextSupport;
    private final BugFlowMapper bugFlowMapper;
    private final BugCommentMapper bugCommentMapper;
    private final BugAttachmentMapper bugAttachmentMapper;
    private final BugCaseRelationMapper bugCaseRelationMapper;
    private final UserService userService;
    private final WorkspaceService workspaceService;

    public BugResponseAssembler(
            BugAttachmentSupport bugAttachmentSupport,
            BugSourceContextSupport bugSourceContextSupport,
            BugFlowMapper bugFlowMapper,
            BugCommentMapper bugCommentMapper,
            BugAttachmentMapper bugAttachmentMapper,
            BugCaseRelationMapper bugCaseRelationMapper,
            UserService userService,
            WorkspaceService workspaceService
    ) {
        this.bugAttachmentSupport = bugAttachmentSupport;
        this.bugSourceContextSupport = bugSourceContextSupport;
        this.bugFlowMapper = bugFlowMapper;
        this.bugCommentMapper = bugCommentMapper;
        this.bugAttachmentMapper = bugAttachmentMapper;
        this.bugCaseRelationMapper = bugCaseRelationMapper;
        this.userService = userService;
        this.workspaceService = workspaceService;
    }

    public BugSummaryResponse toSummary(BugEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        UserEntity assignee = entity.getAssigneeId() == null ? null : userService.requireUser(entity.getAssigneeId());
        UserEntity reporter = userService.requireUser(entity.getReporterId());
        String updatedByName = resolveUpdatedByName(entity, reporter);
        List<BugCaseSummaryResponse> relatedCases = listRelatedCaseSummaries(entity, workspace.getWorkspaceCode());
        Long primaryCaseId = resolvePrimaryCaseId(entity, relatedCases);
        return new BugSummaryResponse(
                entity.getId(),
                entity.getBugNo(),
                entity.getTitle(),
                JsonUtils.toStringList(entity.getTagsJson()),
                BugPriority.valueOf(entity.getPriority()),
                BugSeverity.valueOf(entity.getSeverity()),
                BugStatus.valueOf(entity.getStatus()),
                assignee == null ? "-" : assignee.getDisplayName(),
                reporter.getDisplayName(),
                entity.getCreatedAt(),
                updatedByName,
                entity.getUpdatedAt(),
                primaryCaseId,
                relatedCases.size(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName()
        );
    }

    public BugDetailResponse toDetail(BugEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        UserEntity assignee = entity.getAssigneeId() == null ? null : userService.requireUser(entity.getAssigneeId());
        UserEntity reporter = userService.requireUser(entity.getReporterId());
        String updatedByName = resolveUpdatedByName(entity, reporter);
        List<BugAttachmentEntity> attachmentEntities = listAttachmentEntities(entity.getId());
        List<BugCommentEntity> commentEntities = listCommentEntities(entity.getId());
        List<BugFlowEntity> flowEntities = listFlowEntities(entity.getId());
        List<BugCaseSummaryResponse> relatedCases = listRelatedCaseSummaries(entity, workspace.getWorkspaceCode());
        Long primaryCaseId = resolvePrimaryCaseId(entity, relatedCases);
        return new BugDetailResponse(
                entity.getId(),
                entity.getBugNo(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getReproductionSteps(),
                entity.getExpectedResult(),
                entity.getActualResult(),
                entity.getModuleName(),
                BugPriority.valueOf(entity.getPriority()),
                BugSeverity.valueOf(entity.getSeverity()),
                BugStatus.valueOf(entity.getStatus()),
                BugSourceType.valueOf(entity.getSourceType()),
                entity.getAssigneeId(),
                assignee == null ? "-" : assignee.getDisplayName(),
                entity.getReporterId(),
                reporter.getDisplayName(),
                primaryCaseId,
                relatedCases,
                entity.getRelatedReportId(),
                entity.getRelatedTaskId(),
                JsonUtils.toStringList(entity.getTagsJson()),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                updatedByName,
                attachmentEntities.stream().map(item -> bugAttachmentSupport.toAttachmentResponse(entity, item)).toList(),
                bugSourceContextSupport.buildSourceContext(entity, workspace),
                buildActivities(entity, reporter, flowEntities, commentEntities, attachmentEntities),
                flowEntities.stream().map(this::toFlow).toList(),
                commentEntities.stream().map(this::toComment).toList()
        );
    }

    public BugCommentResponse toComment(BugCommentEntity entity) {
        UserEntity commenter = userService.requireUser(entity.getCommenterId());
        return new BugCommentResponse(
                entity.getId(),
                entity.getContent(),
                entity.getCommenterId(),
                commenter.getDisplayName(),
                entity.getCreatedAt()
        );
    }

    private List<BugFlowEntity> listFlowEntities(Long bugId) {
        return bugFlowMapper.selectList(new LambdaQueryWrapper<BugFlowEntity>()
                .eq(BugFlowEntity::getBugId, bugId)
                .orderByAsc(BugFlowEntity::getId));
    }

    private List<BugCommentEntity> listCommentEntities(Long bugId) {
        return bugCommentMapper.selectList(new LambdaQueryWrapper<BugCommentEntity>()
                .eq(BugCommentEntity::getBugId, bugId)
                .orderByAsc(BugCommentEntity::getId));
    }

    private List<BugAttachmentEntity> listAttachmentEntities(Long bugId) {
        return bugAttachmentMapper.selectList(new LambdaQueryWrapper<BugAttachmentEntity>()
                .eq(BugAttachmentEntity::getBugId, bugId)
                .orderByAsc(BugAttachmentEntity::getId));
    }

    private List<BugCaseSummaryResponse> listRelatedCaseSummaries(BugEntity entity, String workspaceCode) {
        List<Long> caseIds = bugCaseRelationMapper.selectList(new LambdaQueryWrapper<BugCaseRelationEntity>()
                        .eq(BugCaseRelationEntity::getBugId, entity.getId())
                        .orderByAsc(BugCaseRelationEntity::getId))
                .stream()
                .map(BugCaseRelationEntity::getCaseId)
                .toList();
        List<Long> normalizedCaseIds = new ArrayList<>(caseIds);
        if (entity.getRelatedCaseId() != null && !normalizedCaseIds.contains(entity.getRelatedCaseId())) {
            normalizedCaseIds.addFirst(entity.getRelatedCaseId());
        }

        return normalizedCaseIds.stream()
                .map(caseId -> bugSourceContextSupport.safeCaseSummary(caseId, workspaceCode))
                .filter(item -> item != null)
                .toList();
    }

    private Long resolvePrimaryCaseId(BugEntity entity, List<BugCaseSummaryResponse> relatedCases) {
        if (!relatedCases.isEmpty()) {
            return relatedCases.getFirst().id();
        }
        return entity.getRelatedCaseId();
    }

    private String resolveUpdatedByName(BugEntity entity, UserEntity reporter) {
        LocalDateTime latestTime = entity.getUpdatedAt() == null ? entity.getCreatedAt() : entity.getUpdatedAt();
        String updatedByName = reporter.getDisplayName();

        BugFlowEntity latestFlow = bugFlowMapper.selectOne(new LambdaQueryWrapper<BugFlowEntity>()
                .eq(BugFlowEntity::getBugId, entity.getId())
                .orderByDesc(BugFlowEntity::getCreatedAt)
                .last("limit 1"));
        if (latestFlow != null && latestFlow.getCreatedAt() != null
                && (latestTime == null || !latestFlow.getCreatedAt().isBefore(latestTime))) {
            updatedByName = userService.requireUser(latestFlow.getOperatorId()).getDisplayName();
            latestTime = latestFlow.getCreatedAt();
        }

        BugCommentEntity latestComment = bugCommentMapper.selectOne(new LambdaQueryWrapper<BugCommentEntity>()
                .eq(BugCommentEntity::getBugId, entity.getId())
                .orderByDesc(BugCommentEntity::getCreatedAt)
                .last("limit 1"));
        if (latestComment != null && latestComment.getCreatedAt() != null
                && (latestTime == null || latestComment.getCreatedAt().isAfter(latestTime))) {
            updatedByName = userService.requireUser(latestComment.getCommenterId()).getDisplayName();
        }

        return updatedByName;
    }

    private List<BugActivityResponse> buildActivities(
            BugEntity entity,
            UserEntity reporter,
            List<BugFlowEntity> flowEntities,
            List<BugCommentEntity> commentEntities,
            List<BugAttachmentEntity> attachmentEntities
    ) {
        List<BugActivityResponse> activities = new ArrayList<>();
        BugStatus initialStatus = resolveInitialStatus(entity, flowEntities);
        activities.add(new BugActivityResponse(
                "created-" + entity.getId(),
                BugActivityType.CREATED,
                entity.getReporterId(),
                reporter.getDisplayName(),
                entity.getCreatedAt(),
                reporter.getDisplayName() + " 创建了缺陷",
                entity.getBugNo(),
                null,
                initialStatus,
                null,
                null,
                null
        ));

        for (BugFlowEntity flow : flowEntities) {
            UserEntity operator = userService.requireUser(flow.getOperatorId());
            BugStatus fromStatus = BugStatus.valueOf(flow.getFromStatus());
            BugStatus toStatus = BugStatus.valueOf(flow.getToStatus());
            BugActivityType type = toStatus == BugStatus.ASSIGNED ? BugActivityType.ASSIGNED : BugActivityType.STATUS_CHANGED;
            String title = type == BugActivityType.ASSIGNED
                    ? operator.getDisplayName() + " 更新了处理人"
                    : operator.getDisplayName() + " 更新了缺陷状态";
            activities.add(new BugActivityResponse(
                    "flow-" + flow.getId(),
                    type,
                    flow.getOperatorId(),
                    operator.getDisplayName(),
                    flow.getCreatedAt(),
                    title,
                    flow.getActionComment(),
                    fromStatus,
                    toStatus,
                    null,
                    null,
                    null
            ));
        }

        for (BugCommentEntity comment : commentEntities) {
            UserEntity commenter = userService.requireUser(comment.getCommenterId());
            activities.add(new BugActivityResponse(
                    "comment-" + comment.getId(),
                    BugActivityType.COMMENT_ADDED,
                    comment.getCommenterId(),
                    commenter.getDisplayName(),
                    comment.getCreatedAt(),
                    commenter.getDisplayName() + " 添加了评论",
                    comment.getContent(),
                    null,
                    null,
                    null,
                    null,
                    comment.getId()
            ));
        }

        for (BugAttachmentEntity attachment : attachmentEntities) {
            UserEntity uploader = attachment.getCreatedBy() == null ? null : userService.findActiveUser(attachment.getCreatedBy());
            String uploaderName = uploader == null ? null : uploader.getDisplayName();
            activities.add(new BugActivityResponse(
                    "attachment-" + attachment.getId(),
                    BugActivityType.ATTACHMENT_ADDED,
                    attachment.getCreatedBy(),
                    uploaderName,
                    attachment.getCreatedAt(),
                    "上传了附件",
                    attachment.getFileName(),
                    null,
                    null,
                    attachment.getId(),
                    attachment.getFileName(),
                    null
            ));
        }

        return activities.stream()
                .sorted(Comparator
                        .comparing(BugActivityResponse::occurredAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(BugActivityResponse::id, Comparator.nullsLast(String::compareTo)))
                .toList();
    }

    private BugStatus resolveInitialStatus(BugEntity entity, List<BugFlowEntity> flowEntities) {
        if (flowEntities.isEmpty()) {
            return BugStatus.valueOf(entity.getStatus());
        }
        BugFlowEntity firstFlow = flowEntities.getFirst();
        if (entity.getAssigneeId() != null
                && BugStatus.TODO.name().equals(firstFlow.getFromStatus())
                && BugStatus.ASSIGNED.name().equals(firstFlow.getToStatus())) {
            return BugStatus.ASSIGNED;
        }
        return BugStatus.valueOf(firstFlow.getFromStatus());
    }

    private BugFlowResponse toFlow(BugFlowEntity entity) {
        UserEntity operator = userService.requireUser(entity.getOperatorId());
        return new BugFlowResponse(
                entity.getId(),
                BugStatus.valueOf(entity.getFromStatus()),
                BugStatus.valueOf(entity.getToStatus()),
                entity.getOperatorId(),
                operator.getDisplayName(),
                entity.getActionComment(),
                entity.getCreatedAt()
        );
    }
}
