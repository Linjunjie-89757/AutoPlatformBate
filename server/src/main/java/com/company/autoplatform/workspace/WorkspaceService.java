package com.company.autoplatform.workspace;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class WorkspaceService {

    private final WorkspaceAccessSupport workspaceAccessSupport;
    private final WorkspaceMemberDomainService workspaceMemberDomainService;
    private final WorkspaceDomainService workspaceDomainService;
    private final WorkspaceRoleDomainService workspaceRoleDomainService;

    public WorkspaceService(
            WorkspaceAccessSupport workspaceAccessSupport,
            WorkspaceDomainService workspaceDomainService,
            WorkspaceMemberDomainService workspaceMemberDomainService,
            WorkspaceRoleDomainService workspaceRoleDomainService
    ) {
        this.workspaceAccessSupport = workspaceAccessSupport;
        this.workspaceDomainService = workspaceDomainService;
        this.workspaceMemberDomainService = workspaceMemberDomainService;
        this.workspaceRoleDomainService = workspaceRoleDomainService;
    }

    public List<WorkspaceItem> listAll() {
        return workspaceAccessSupport.listReadableWorkspaceEntities().stream()
                .map(workspaceDomainService::toWorkspaceItem)
                .toList();
    }

    public List<WorkspaceItem> listSwitchable() {
        List<WorkspaceItem> result = new ArrayList<>();
        result.add(new WorkspaceItem(WorkspaceScope.ALL, "全部", "查看当前账号可见的全部空间数据", true,
                null, null, null, 1, null, null));
        result.addAll(listAll());
        return result;
    }

    public WorkspaceEntity requireWorkspace(String workspaceCode) {
        return workspaceDomainService.requireWorkspace(workspaceCode);
    }

    public WorkspaceEntity requireReadableWorkspace(String workspaceCode) {
        return workspaceAccessSupport.requireReadableWorkspace(workspaceCode);
    }

    public WorkspaceEntity requireWritableWorkspace(String workspaceCode) {
        return workspaceAccessSupport.requireWritableWorkspace(workspaceCode);
    }

    public WorkspaceEntity requireWorkspaceById(Long workspaceId) {
        return workspaceDomainService.requireWorkspaceById(workspaceId);
    }

    public String resolveTargetWorkspace(String headerWorkspaceCode, String bodyWorkspaceCode) {
        return workspaceAccessSupport.resolveTargetWorkspace(headerWorkspaceCode, bodyWorkspaceCode);
    }

    public WorkspaceItem createWorkspace(CreateWorkspaceRequest request) {
        return workspaceDomainService.createWorkspace(request);
    }

    public WorkspaceItem updateWorkspace(String workspaceCode, CreateWorkspaceRequest request) {
        return workspaceDomainService.updateWorkspace(workspaceCode, request);
    }

    public void deleteWorkspace(String workspaceCode) {
        workspaceDomainService.deleteWorkspace(workspaceCode);
    }

    public List<WorkspaceMemberItem> listMembers(String workspaceCode) {
        return workspaceMemberDomainService.listMembers(workspaceCode);
    }

    public WorkspaceMemberItem createMember(String workspaceCode, CreateWorkspaceMemberRequest request) {
        return workspaceMemberDomainService.createMember(workspaceCode, request);
    }

    public List<WorkspaceMemberItem> createMembers(String workspaceCode, BatchWorkspaceMemberRequest request) {
        return workspaceMemberDomainService.createMembers(workspaceCode, request);
    }

    public WorkspaceMemberItem updateMember(String workspaceCode, Long memberId, UpdateWorkspaceMemberRequest request) {
        return workspaceMemberDomainService.updateMember(workspaceCode, memberId, request);
    }

    public void deleteMember(String workspaceCode, Long memberId) {
        workspaceMemberDomainService.deleteMember(workspaceCode, memberId);
    }

    public List<WorkspaceRoleItem> listRoles(String workspaceCode) {
        return workspaceRoleDomainService.listRoles(workspaceCode);
    }

    public WorkspaceRoleItem createRole(String workspaceCode, CreateWorkspaceRoleRequest request) {
        return workspaceRoleDomainService.createRole(workspaceCode, request);
    }

    public List<WorkspaceEntity> listReadableWorkspaceEntities() {
        return workspaceAccessSupport.listReadableWorkspaceEntities();
    }

    public List<Long> listReadableWorkspaceIds() {
        return workspaceAccessSupport.listReadableWorkspaceIds();
    }

    public List<String> listReadableWorkspaceCodes() {
        return workspaceAccessSupport.listReadableWorkspaceCodes();
    }

    public boolean isSuperAdmin() {
        return workspaceAccessSupport.isSuperAdmin();
    }

    public boolean isPlatformAdmin() {
        return workspaceAccessSupport.isPlatformAdmin();
    }

    public void requirePlatformAdmin() {
        workspaceAccessSupport.requirePlatformAdmin();
    }

}
