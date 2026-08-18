package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TestActivityLogService {

    private final TestActivityLogMapper mapper;
    private final ObjectMapper objectMapper;
    private final UserMapper userMapper;

    public TestActivityLogService(TestActivityLogMapper mapper, ObjectMapper objectMapper, UserMapper userMapper) {
        this.mapper = mapper;
        this.objectMapper = objectMapper;
        this.userMapper = userMapper;
    }

    @Transactional
    public TestActivityLogEntity record(
            Long workspaceId,
            ActivityEntityType entityType,
            Long entityId,
            String actionCode,
            String actionName,
            Object detail
    ) {
        validate(workspaceId, entityType, entityId, actionCode, actionName);
        LocalDateTime now = LocalDateTime.now();
        TestActivityLogEntity entity = new TestActivityLogEntity();
        entity.setWorkspaceId(workspaceId);
        entity.setEntityType(entityType);
        entity.setEntityId(entityId);
        entity.setActionCode(actionCode.trim());
        entity.setActionName(actionName.trim());
        entity.setDetail(serializeDetail(detail));
        entity.setActorId(CurrentUserContext.get());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        mapper.insert(entity);
        return entity;
    }

    public PageResponse<TestActivityItem> list(
            Long workspaceId,
            ActivityEntityType entityType,
            Long entityId,
            Integer pageNo,
            Integer pageSize
    ) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : Math.min(pageSize, 100);
        Page<TestActivityLogEntity> page = mapper.selectPage(
                new Page<>(safePageNo, safePageSize),
                new LambdaQueryWrapper<TestActivityLogEntity>()
                        .eq(TestActivityLogEntity::getWorkspaceId, workspaceId)
                        .eq(TestActivityLogEntity::getEntityType, entityType)
                        .eq(TestActivityLogEntity::getEntityId, entityId)
                        .orderByDesc(TestActivityLogEntity::getCreatedAt)
                        .orderByDesc(TestActivityLogEntity::getId)
        );
        Map<Long, UserEntity> users = loadUsers(page.getRecords());
        List<TestActivityItem> items = page.getRecords().stream()
                .map(entity -> {
                    UserEntity actor = entity.getActorId() == null ? null : users.get(entity.getActorId());
                    return new TestActivityItem(
                            entity.getId(),
                            entity.getEntityType(),
                            entity.getEntityId(),
                            entity.getActionCode(),
                            entity.getActionName(),
                            entity.getDetail(),
                            entity.getActorId(),
                            actor == null ? "系统" : actor.getDisplayName(),
                            entity.getCreatedAt()
                    );
                })
                .toList();
        return PageResponse.of(items, page.getTotal(), page.getCurrent(), page.getSize());
    }

    private void validate(
            Long workspaceId,
            ActivityEntityType entityType,
            Long entityId,
            String actionCode,
            String actionName
    ) {
        if (workspaceId == null || workspaceId <= 0) {
            throw TestManagementException.validation("活动日志工作区不能为空");
        }
        if (entityType == null || entityId == null || entityId <= 0) {
            throw TestManagementException.validation("活动日志业务对象不能为空");
        }
        if (actionCode == null || actionCode.isBlank() || actionName == null || actionName.isBlank()) {
            throw TestManagementException.validation("活动日志动作不能为空");
        }
    }

    private String serializeDetail(Object detail) {
        if (detail == null) {
            return null;
        }
        if (detail instanceof String text) {
            return text;
        }
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException exception) {
            throw TestManagementException.validation("活动日志详情无法序列化");
        }
    }

    private Map<Long, UserEntity> loadUsers(List<TestActivityLogEntity> activities) {
        List<Long> userIds = activities.stream()
                .map(TestActivityLogEntity::getActorId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(UserEntity::getId, Function.identity()));
    }
}
