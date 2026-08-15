package com.company.autoplatform.platformadmin;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.workspace.CreateWorkspaceRequest;
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
@RequestMapping("/api/platform-admin/workspaces")
public class PlatformWorkspaceController {

    private final PlatformWorkspaceService service;

    public PlatformWorkspaceController(PlatformWorkspaceService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PlatformWorkspaceItem>> listWorkspaces() {
        return ApiResponse.ok(service.listWorkspaces());
    }

    @PostMapping
    public ApiResponse<PlatformWorkspaceItem> createWorkspace(
            @Valid @RequestBody CreateWorkspaceRequest request
    ) {
        return ApiResponse.ok(service.createWorkspace(request), "工作区创建成功");
    }

    @PutMapping("/{workspaceCode}/status")
    public ApiResponse<PlatformWorkspaceItem> updateStatus(
            @PathVariable String workspaceCode,
            @Valid @RequestBody PlatformWorkspaceStatusRequest request
    ) {
        return ApiResponse.ok(service.updateStatus(workspaceCode, request.status()), "工作区状态更新成功");
    }

    @DeleteMapping("/{workspaceCode}")
    public ApiResponse<Void> deleteWorkspace(@PathVariable String workspaceCode) {
        service.deleteWorkspace(workspaceCode);
        return ApiResponse.ok(null, "工作区删除成功");
    }
}
