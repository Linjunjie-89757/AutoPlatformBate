package com.company.autoplatform.workspace;

import com.company.autoplatform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final WorkspaceJoinService workspaceJoinService;

    public WorkspaceController(WorkspaceService workspaceService, WorkspaceJoinService workspaceJoinService) {
        this.workspaceService = workspaceService;
        this.workspaceJoinService = workspaceJoinService;
    }

    @GetMapping
    public ApiResponse<List<WorkspaceItem>> listWorkspaces() {
        return ApiResponse.ok(workspaceService.listAll());
    }

    @GetMapping("/switchable")
    public ApiResponse<List<WorkspaceItem>> listSwitchable() {
        return ApiResponse.ok(workspaceService.listSwitchable());
    }

    @GetMapping("/join/candidates")
    public ApiResponse<List<WorkspaceJoinCandidateItem>> listJoinCandidates(
            @RequestParam(required = false) String query
    ) {
        return ApiResponse.ok(workspaceJoinService.listCandidates(query));
    }

    @GetMapping("/join-applications/pending")
    public ApiResponse<WorkspaceJoinApplicationItem> getCurrentPendingApplication() {
        return ApiResponse.ok(workspaceJoinService.getCurrentPendingApplication());
    }

    @PostMapping("/{workspaceCode}/join-applications")
    public ApiResponse<WorkspaceJoinApplicationItem> createJoinApplication(
            @PathVariable String workspaceCode
    ) {
        return ApiResponse.ok(workspaceJoinService.createApplication(workspaceCode), "工作区申请已提交");
    }

    @DeleteMapping("/join-applications/{applicationId}")
    public ApiResponse<Void> cancelJoinApplication(@PathVariable Long applicationId) {
        workspaceJoinService.cancelApplication(applicationId);
        return ApiResponse.ok(null, "工作区申请已撤销");
    }

    @PostMapping("/join-by-invitation")
    public ApiResponse<WorkspaceItem> joinByInvitation(
            @Valid @RequestBody JoinWorkspaceByInvitationRequest request
    ) {
        return ApiResponse.ok(workspaceJoinService.joinByInvitation(request), "已加入工作区");
    }

    @GetMapping("/{workspaceCode}/join-applications")
    public ApiResponse<List<WorkspaceJoinApplicationItem>> listJoinApplications(
            @PathVariable String workspaceCode,
            @RequestParam(required = false) String status
    ) {
        return ApiResponse.ok(workspaceJoinService.listApplications(workspaceCode, status));
    }

    @PostMapping("/{workspaceCode}/join-applications/{applicationId}/approve")
    public ApiResponse<WorkspaceJoinApplicationItem> approveJoinApplication(
            @PathVariable String workspaceCode,
            @PathVariable Long applicationId
    ) {
        return ApiResponse.ok(
                workspaceJoinService.approveApplication(workspaceCode, applicationId),
                "工作区申请已通过"
        );
    }

    @PostMapping("/{workspaceCode}/join-applications/{applicationId}/reject")
    public ApiResponse<WorkspaceJoinApplicationItem> rejectJoinApplication(
            @PathVariable String workspaceCode,
            @PathVariable Long applicationId
    ) {
        return ApiResponse.ok(
                workspaceJoinService.rejectApplication(workspaceCode, applicationId),
                "工作区申请已拒绝"
        );
    }

    @PostMapping("/{workspaceCode}/invitations")
    public ApiResponse<WorkspaceInvitationItem> createInvitation(
            @PathVariable String workspaceCode,
            @Valid @RequestBody CreateWorkspaceInvitationRequest request
    ) {
        return ApiResponse.ok(
                workspaceJoinService.createInvitation(workspaceCode, request),
                "工作区邀请码已生成"
        );
    }

    @PostMapping
    public ApiResponse<WorkspaceItem> createWorkspace(@Valid @RequestBody CreateWorkspaceRequest request) {
        return ApiResponse.ok(workspaceService.createWorkspace(request), "工作空间创建成功");
    }

    @PutMapping("/{workspaceCode}")
    public ApiResponse<WorkspaceItem> updateWorkspace(
            @PathVariable String workspaceCode,
            @Valid @RequestBody CreateWorkspaceRequest request
    ) {
        return ApiResponse.ok(workspaceService.updateWorkspace(workspaceCode, request), "工作空间更新成功");
    }

    @DeleteMapping("/{workspaceCode}")
    public ApiResponse<Void> deleteWorkspace(@PathVariable String workspaceCode) {
        workspaceService.deleteWorkspace(workspaceCode);
        return ApiResponse.ok(null, "工作空间删除成功");
    }

    @GetMapping("/{workspaceCode}/members")
    public ApiResponse<List<WorkspaceMemberItem>> listMembers(@PathVariable String workspaceCode) {
        return ApiResponse.ok(workspaceService.listMembers(workspaceCode));
    }

    @GetMapping("/{workspaceCode}/members/lookup")
    public ApiResponse<WorkspaceMemberCandidateItem> findMemberCandidate(
            @PathVariable String workspaceCode,
            @RequestParam String account
    ) {
        return ApiResponse.ok(workspaceService.findMemberCandidate(workspaceCode, account));
    }

    @GetMapping("/{workspaceCode}/member-candidates")
    public ApiResponse<List<WorkspaceMemberCandidateItem>> listMemberCandidates(
            @PathVariable String workspaceCode
    ) {
        return ApiResponse.ok(workspaceService.listMemberCandidates(workspaceCode));
    }

    @PostMapping("/{workspaceCode}/members")
    public ApiResponse<WorkspaceMemberItem> createMember(
            @PathVariable String workspaceCode,
            @Valid @RequestBody CreateWorkspaceMemberRequest request
    ) {
        return ApiResponse.ok(workspaceService.createMember(workspaceCode, request), "成员添加成功");
    }

    @PostMapping("/{workspaceCode}/members/batch")
    public ApiResponse<List<WorkspaceMemberItem>> createMembers(
            @PathVariable String workspaceCode,
            @Valid @RequestBody BatchWorkspaceMemberRequest request
    ) {
        return ApiResponse.ok(workspaceService.createMembers(workspaceCode, request), "成员批量添加成功");
    }

    @PutMapping("/{workspaceCode}/members/{memberId}")
    public ApiResponse<WorkspaceMemberItem> updateMember(
            @PathVariable String workspaceCode,
            @PathVariable Long memberId,
            @Valid @RequestBody UpdateWorkspaceMemberRequest request
    ) {
        return ApiResponse.ok(workspaceService.updateMember(workspaceCode, memberId, request), "成员角色更新成功");
    }

    @DeleteMapping("/{workspaceCode}/members/{memberId}")
    public ApiResponse<Void> deleteMember(
            @PathVariable String workspaceCode,
            @PathVariable Long memberId
    ) {
        workspaceService.deleteMember(workspaceCode, memberId);
        return ApiResponse.ok(null, "成员移除成功");
    }

    @GetMapping("/{workspaceCode}/roles")
    public ApiResponse<List<WorkspaceRoleItem>> listRoles(@PathVariable String workspaceCode) {
        return ApiResponse.ok(workspaceService.listRoles(workspaceCode));
    }

    @PostMapping("/{workspaceCode}/roles")
    public ApiResponse<WorkspaceRoleItem> createRole(
            @PathVariable String workspaceCode,
            @Valid @RequestBody CreateWorkspaceRoleRequest request
    ) {
        return ApiResponse.ok(workspaceService.createRole(workspaceCode, request), "角色创建成功");
    }

    @DeleteMapping("/{workspaceCode}/roles/{roleId}")
    public ApiResponse<Void> deleteRole(
            @PathVariable String workspaceCode,
            @PathVariable Long roleId
    ) {
        workspaceService.deleteRole(workspaceCode, roleId);
        return ApiResponse.ok(null, "角色删除成功");
    }

    @GetMapping("/{workspaceCode}/permissions/catalog")
    public ApiResponse<List<WorkspacePermissionModuleItem>> listPermissionCatalog(
            @PathVariable String workspaceCode
    ) {
        return ApiResponse.ok(workspaceService.listPermissionCatalog(workspaceCode));
    }

    @GetMapping("/{workspaceCode}/roles/{roleId}/permissions")
    public ApiResponse<WorkspaceRolePermissionItem> listRolePermissions(
            @PathVariable String workspaceCode,
            @PathVariable Long roleId
    ) {
        return ApiResponse.ok(workspaceService.listRolePermissions(workspaceCode, roleId));
    }

    @PutMapping("/{workspaceCode}/roles/{roleId}/permissions")
    public ApiResponse<WorkspaceRolePermissionItem> updateRolePermissions(
            @PathVariable String workspaceCode,
            @PathVariable Long roleId,
            @Valid @RequestBody UpdateWorkspaceRolePermissionsRequest request
    ) {
        return ApiResponse.ok(
                workspaceService.updateRolePermissions(workspaceCode, roleId, request),
                "角色权限保存成功"
        );
    }
}
