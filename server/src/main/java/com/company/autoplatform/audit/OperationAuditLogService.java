package com.company.autoplatform.audit;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class OperationAuditLogService {

    private static final Set<String> CATEGORIES = Set.of("AUTH", "WORKSPACE", "TEST_ASSET", "EXECUTION", "CONFIG", "OTHER");
    private static final Set<String> RESULTS = Set.of("SUCCESS", "FAILED");
    private static final long DEFAULT_PAGE_SIZE = 10;
    private static final long MAX_PAGE_SIZE = 100;

    private final OperationAuditLogMapper mapper;
    private final WorkspaceService workspaceService;

    public OperationAuditLogService(OperationAuditLogMapper mapper, WorkspaceService workspaceService) {
        this.mapper = mapper;
        this.workspaceService = workspaceService;
    }

    public PageResponse<OperationAuditLogItem> list(
            String workspaceCode,
            String keyword,
            String category,
            String result,
            Long pageNo,
            Long pageSize
    ) {
        CurrentUserPrincipal currentUser = CurrentUserContext.require();
        String normalizedWorkspace = WorkspaceScope.normalize(workspaceCode);
        LambdaQueryWrapper<OperationAuditLogEntity> query = new LambdaQueryWrapper<>();
        if (!WorkspaceScope.isAll(normalizedWorkspace)) {
            workspaceService.requireReadableWorkspace(normalizedWorkspace);
            query.eq(OperationAuditLogEntity::getWorkspaceCode, normalizedWorkspace);
        } else if (!workspaceService.isPlatformAdmin()) {
            List<String> readableCodes = workspaceService.listReadableWorkspaceCodes();
            query.and(scope -> {
                if (!readableCodes.isEmpty()) {
                    scope.in(OperationAuditLogEntity::getWorkspaceCode, readableCodes).or();
                }
                scope.and(global -> global
                        .isNull(OperationAuditLogEntity::getWorkspaceCode)
                        .eq(OperationAuditLogEntity::getOperatorUserId, currentUser.userId()));
            });
        }

        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(item -> item
                    .like(OperationAuditLogEntity::getOperatorUsername, trimmedKeyword)
                    .or().like(OperationAuditLogEntity::getOperatorDisplayName, trimmedKeyword)
                    .or().like(OperationAuditLogEntity::getActionName, trimmedKeyword)
                    .or().like(OperationAuditLogEntity::getTarget, trimmedKeyword));
        }
        String normalizedCategory = normalizeEnum(category, CATEGORIES, "无效的日志分类");
        if (normalizedCategory != null) query.eq(OperationAuditLogEntity::getCategory, normalizedCategory);
        String normalizedResult = normalizeEnum(result, RESULTS, "无效的日志结果");
        if (normalizedResult != null) query.eq(OperationAuditLogEntity::getResult, normalizedResult);

        long safePageNo = pageNo == null || pageNo <= 0 ? 1 : pageNo;
        long safePageSize = pageSize == null || pageSize <= 0 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
        Page<OperationAuditLogEntity> page = mapper.selectPage(
                new Page<>(safePageNo, safePageSize),
                query.orderByDesc(OperationAuditLogEntity::getId)
        );
        return PageResponse.of(
                page.getRecords().stream().map(this::toItem).toList(),
                page.getTotal(),
                page.getCurrent(),
                page.getSize()
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            String workspaceCode,
            CurrentUserPrincipal operator,
            OperationAuditDescriptor descriptor,
            String requestMethod,
            String sourceIp,
            int statusCode,
            long durationMs
    ) {
        OperationAuditLogEntity entity = new OperationAuditLogEntity();
        entity.setWorkspaceCode(blankToNull(workspaceCode));
        if (operator != null) {
            entity.setOperatorUserId(operator.userId());
            entity.setOperatorUsername(operator.username());
            entity.setOperatorDisplayName(operator.displayName());
        }
        entity.setCategory(descriptor.category());
        entity.setActionCode(descriptor.actionCode());
        entity.setActionName(descriptor.actionName());
        entity.setTarget(descriptor.target());
        entity.setRequestMethod(requestMethod);
        entity.setSourceIp(blankToNull(sourceIp));
        entity.setResult(statusCode >= 400 ? "FAILED" : "SUCCESS");
        entity.setStatusCode(statusCode);
        entity.setDurationMs(Math.max(durationMs, 0));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        mapper.insert(entity);
    }

    private OperationAuditLogItem toItem(OperationAuditLogEntity entity) {
        return new OperationAuditLogItem(
                entity.getId(), entity.getWorkspaceCode(), entity.getOperatorUserId(), entity.getOperatorUsername(),
                entity.getOperatorDisplayName(), entity.getCategory(), entity.getActionCode(), entity.getActionName(),
                entity.getTarget(), entity.getRequestMethod(), entity.getSourceIp(), entity.getResult(),
                entity.getStatusCode(), entity.getDurationMs(), entity.getCreatedAt()
        );
    }

    private String normalizeEnum(String value, Set<String> allowed, String message) {
        String normalized = blankToNull(value);
        if (normalized == null) return null;
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) throw new BadRequestException(message + ": " + value);
        return normalized;
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
