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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    public WorkspaceController(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    @GetMapping
    public ApiResponse<List<WorkspaceItem>> listWorkspaces() {
        return ApiResponse.ok(workspaceService.listAll());
    }

    @GetMapping("/switchable")
    public ApiResponse<List<WorkspaceItem>> listSwitchable() {
        return ApiResponse.ok(workspaceService.listSwitchable());
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
}
