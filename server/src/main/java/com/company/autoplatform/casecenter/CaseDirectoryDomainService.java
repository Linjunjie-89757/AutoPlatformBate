package com.company.autoplatform.casecenter;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CaseDirectoryDomainService {
    private final CaseMapper caseMapper;
    private final CaseDirectoryMapper caseDirectoryMapper;
    private final WorkspaceService workspaceService;

    CaseDirectoryDomainService(
            CaseMapper caseMapper,
            CaseDirectoryMapper caseDirectoryMapper,
            WorkspaceService workspaceService
    ) {
        this.caseMapper = caseMapper;
        this.caseDirectoryMapper = caseDirectoryMapper;
        this.workspaceService = workspaceService;
    }

    public List<CaseDirectoryWorkspaceResponse> listDirectories(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        List<WorkspaceEntity> readableWorkspaces;
        if (!WorkspaceScope.isAll(normalized)) {
            readableWorkspaces = List.of(workspaceService.requireReadableWorkspace(normalized));
        } else {
            readableWorkspaces = workspaceService.listReadableWorkspaceEntities();
        }
        if (readableWorkspaces.isEmpty()) {
            return List.of();
        }

        List<Long> workspaceIds = readableWorkspaces.stream().map(WorkspaceEntity::getId).toList();
        List<CaseDirectoryEntity> directories = caseDirectoryMapper.selectList(new LambdaQueryWrapper<CaseDirectoryEntity>()
                .in(CaseDirectoryEntity::getWorkspaceId, workspaceIds)
                .orderByAsc(CaseDirectoryEntity::getWorkspaceId)
                .orderByAsc(CaseDirectoryEntity::getId));
        Map<Long, Long> caseCountsByWorkspaceId = new HashMap<>();
        Map<Long, Long> caseCountsByDirectoryId = new HashMap<>();
        caseMapper.selectList(new LambdaQueryWrapper<CaseEntity>()
                        .select(CaseEntity::getWorkspaceId, CaseEntity::getCaseDirectoryId)
                        .in(CaseEntity::getWorkspaceId, workspaceIds))
                .forEach(item -> {
                    caseCountsByWorkspaceId.merge(item.getWorkspaceId(), 1L, Long::sum);
                    if (item.getCaseDirectoryId() != null) {
                        caseCountsByDirectoryId.merge(item.getCaseDirectoryId(), 1L, Long::sum);
                    }
                });
        Map<Long, List<CaseDirectoryEntity>> grouped = directories.stream()
                .collect(Collectors.groupingBy(CaseDirectoryEntity::getWorkspaceId, LinkedHashMap::new, Collectors.toList()));

        return readableWorkspaces.stream()
                .map(workspace -> new CaseDirectoryWorkspaceResponse(
                        workspace.getWorkspaceCode(),
                        workspace.getWorkspaceName(),
                        caseCountsByWorkspaceId.getOrDefault(workspace.getId(), 0L),
                        buildDirectoryTree(
                                workspace,
                                grouped.getOrDefault(workspace.getId(), List.of()),
                                caseCountsByDirectoryId
                        )
                ))
                .toList();
    }

    public CaseDirectoryNodeResponse createDirectory(String headerWorkspaceCode, CreateCaseDirectoryRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        CaseDirectoryEntity parent = requireParentDirectory(workspace, request.parentId());

        CaseDirectoryEntity entity = new CaseDirectoryEntity();
        entity.setWorkspaceId(workspace.getId());
        entity.setParentId(parent == null ? null : parent.getId());
        entity.setDirectoryName(request.name().trim());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        caseDirectoryMapper.insert(entity);
        return toDirectoryNode(entity, workspace, 0L, List.of());
    }

    public CaseDirectoryNodeResponse renameDirectory(Long id, String workspaceCode, RenameCaseDirectoryRequest request) {
        CaseDirectoryEntity entity = requireDirectory(id);
        validateDirectoryReadable(entity, workspaceCode);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());

        entity.setDirectoryName(request.name().trim());
        entity.setUpdatedAt(LocalDateTime.now());
        caseDirectoryMapper.updateById(entity);
        return toDirectoryNode(entity, workspace, countDirectCases(entity.getId()), List.of());
    }

    public CaseDirectoryNodeResponse moveDirectory(Long id, String workspaceCode, MoveCaseDirectoryRequest request) {
        CaseDirectoryEntity entity = requireDirectory(id);
        validateDirectoryReadable(entity, workspaceCode);
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());

        CaseDirectoryEntity targetParent = requireParentDirectory(workspace, request.targetParentId());
        if (targetParent != null && targetParent.getId().equals(entity.getId())) {
            throw new BadRequestException("目录不能移动到自己下面");
        }
        if (targetParent != null) {
            Set<Long> descendantIds = collectDescendantIds(entity.getWorkspaceId(), entity.getId());
            if (descendantIds.contains(targetParent.getId())) {
                throw new BadRequestException("目录不能移动到自己的子节点下面");
            }
        }

        entity.setParentId(targetParent == null ? null : targetParent.getId());
        entity.setUpdatedAt(LocalDateTime.now());
        caseDirectoryMapper.updateById(entity);
        return toDirectoryNode(entity, workspace, countDirectCases(entity.getId()), List.of());
    }

    public void deleteDirectory(Long id, String workspaceCode) {
        CaseDirectoryEntity entity = requireDirectory(id);
        validateDirectoryReadable(entity, workspaceCode);
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());

        long childCount = caseDirectoryMapper.selectCount(new LambdaQueryWrapper<CaseDirectoryEntity>()
                .eq(CaseDirectoryEntity::getParentId, entity.getId()));
        if (childCount > 0) {
            throw new BadRequestException("当前目录下还有子模块，暂不允许删除");
        }

        long boundCaseCount = caseMapper.selectCount(new LambdaQueryWrapper<CaseEntity>()
                .eq(CaseEntity::getCaseDirectoryId, entity.getId()));
        if (boundCaseCount > 0) {
            throw new BadRequestException("当前目录下还有用例，暂不允许删除");
        }

        caseDirectoryMapper.deleteById(id);
    }

    public CaseDirectoryEntity requireDirectory(Long id) {
        CaseDirectoryEntity entity = caseDirectoryMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("目录不存在");
        }
        return entity;
    }

    CaseDirectoryEntity requireDirectoryForWorkspace(WorkspaceEntity workspace, Long directoryId) {
        if (directoryId == null) {
            return null;
        }
        CaseDirectoryEntity directory = requireDirectory(directoryId);
        if (!directory.getWorkspaceId().equals(workspace.getId())) {
            throw new BadRequestException("目录不属于当前工作空间");
        }
        return directory;
    }

    Set<Long> collectDescendantIds(Long workspaceId, Long rootId) {
        List<CaseDirectoryEntity> directories = caseDirectoryMapper.selectList(new LambdaQueryWrapper<CaseDirectoryEntity>()
                .eq(CaseDirectoryEntity::getWorkspaceId, workspaceId)
                .orderByAsc(CaseDirectoryEntity::getId));
        Map<Long, List<CaseDirectoryEntity>> childrenByParent = directories.stream()
                .filter(item -> item.getParentId() != null)
                .collect(Collectors.groupingBy(CaseDirectoryEntity::getParentId));

        Set<Long> result = new HashSet<>();
        List<Long> stack = new ArrayList<>();
        stack.add(rootId);
        while (!stack.isEmpty()) {
            Long current = stack.remove(stack.size() - 1);
            result.add(current);
            for (CaseDirectoryEntity child : childrenByParent.getOrDefault(current, List.of())) {
                stack.add(child.getId());
            }
        }
        return result;
    }

    private void validateDirectoryReadable(CaseDirectoryEntity entity, String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (WorkspaceScope.isAll(normalized)) {
            if (!workspaceService.isPlatformAdmin()
                    && !workspaceService.listReadableWorkspaceIds().contains(entity.getWorkspaceId())) {
                throw new BadRequestException("当前空间上下文不可访问该目录");
            }
            return;
        }
        WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
        if (!workspace.getId().equals(entity.getWorkspaceId())) {
            throw new BadRequestException("当前空间上下文不可访问该目录");
        }
    }

    private CaseDirectoryEntity requireParentDirectory(WorkspaceEntity workspace, Long parentId) {
        if (parentId == null) {
            return null;
        }
        return requireDirectoryForWorkspace(workspace, parentId);
    }

    private List<CaseDirectoryNodeResponse> buildDirectoryTree(
            WorkspaceEntity workspace,
            List<CaseDirectoryEntity> directories,
            Map<Long, Long> caseCountsByDirectoryId
    ) {
        Map<Long, List<CaseDirectoryEntity>> childrenByParent = directories.stream()
                .collect(Collectors.groupingBy(item -> item.getParentId() == null ? 0L : item.getParentId(), LinkedHashMap::new, Collectors.toList()));
        return buildDirectoryChildren(workspace, childrenByParent, 0L, caseCountsByDirectoryId);
    }

    private List<CaseDirectoryNodeResponse> buildDirectoryChildren(
            WorkspaceEntity workspace,
            Map<Long, List<CaseDirectoryEntity>> childrenByParent,
            Long parentId,
            Map<Long, Long> caseCountsByDirectoryId
    ) {
        List<CaseDirectoryEntity> currentChildren = childrenByParent.getOrDefault(parentId, List.of());
        List<CaseDirectoryNodeResponse> result = new ArrayList<>();
        for (CaseDirectoryEntity child : currentChildren) {
            List<CaseDirectoryNodeResponse> children = buildDirectoryChildren(
                    workspace,
                    childrenByParent,
                    child.getId(),
                    caseCountsByDirectoryId
            );
            long descendantCaseCount = children.stream()
                    .mapToLong(CaseDirectoryNodeResponse::caseCount)
                    .sum();
            long caseCount = caseCountsByDirectoryId.getOrDefault(child.getId(), 0L) + descendantCaseCount;
            result.add(toDirectoryNode(child, workspace, caseCount, children));
        }
        return result;
    }

    private long countDirectCases(Long directoryId) {
        return caseMapper.selectCount(new LambdaQueryWrapper<CaseEntity>()
                .eq(CaseEntity::getCaseDirectoryId, directoryId));
    }

    private CaseDirectoryNodeResponse toDirectoryNode(
            CaseDirectoryEntity entity,
            WorkspaceEntity workspace,
            long caseCount,
            List<CaseDirectoryNodeResponse> children
    ) {
        return new CaseDirectoryNodeResponse(
                entity.getId(),
                entity.getDirectoryName(),
                workspace.getWorkspaceCode(),
                workspace.getWorkspaceName(),
                entity.getParentId(),
                caseCount,
                children
        );
    }
}
