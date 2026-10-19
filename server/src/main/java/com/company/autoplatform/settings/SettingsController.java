package com.company.autoplatform.settings;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping("/overview")
    public ApiResponse<SettingsOverviewResponse> overview(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(settingsService.overview(workspaceCode));
    }

    @GetMapping("/envs")
    public ApiResponse<PageResponse<EnvConfigItem>> listEnvs(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "envType", required = false) String envType,
            @RequestParam(value = "status", required = false) Integer status
    ) {
        return ApiResponse.ok(settingsService.listEnvs(workspaceCode, keyword, envType, status));
    }

    @PostMapping("/envs")
    public ApiResponse<EnvConfigItem> createEnv(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateEnvConfigRequest request
    ) {
        return ApiResponse.ok(settingsService.createEnv(workspaceCode, request), "环境创建成功");
    }

    @PutMapping("/envs/{id}")
    public ApiResponse<EnvConfigItem> updateEnv(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateEnvConfigRequest request
    ) {
        return ApiResponse.ok(settingsService.updateEnv(id, workspaceCode, request), "环境更新成功");
    }

    @PutMapping("/envs/{id}/status")
    public ApiResponse<EnvConfigItem> updateEnvStatus(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody UpdateSettingStatusRequest request
    ) {
        return ApiResponse.ok(settingsService.updateEnvStatus(id, workspaceCode, request), "环境状态更新成功");
    }

    @GetMapping("/envs/{id}/references")
    public ApiResponse<ConfigReferenceModels.ConfigReferenceSummary> environmentReferences(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(settingsService.environmentReferences(id, workspaceCode));
    }

    @DeleteMapping("/envs/{id}")
    public ApiResponse<Void> deleteEnv(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        settingsService.deleteEnv(id, workspaceCode);
        return ApiResponse.ok(null, "环境删除成功");
    }

    @GetMapping("/params")
    public ApiResponse<PageResponse<ParamSetItem>> listParams(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "paramType", required = false) String paramType,
            @RequestParam(value = "status", required = false) Integer status
    ) {
        return ApiResponse.ok(settingsService.listParams(workspaceCode, keyword, paramType, status));
    }

    @PostMapping("/params")
    public ApiResponse<ParamSetItem> createParam(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateParamSetRequest request
    ) {
        return ApiResponse.ok(settingsService.createParam(workspaceCode, request), "参数集创建成功");
    }

    @PutMapping("/params/{id}")
    public ApiResponse<ParamSetItem> updateParam(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody CreateParamSetRequest request
    ) {
        return ApiResponse.ok(settingsService.updateParam(id, workspaceCode, request), "参数集更新成功");
    }

    @PutMapping("/params/{id}/status")
    public ApiResponse<ParamSetItem> updateParamStatus(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody UpdateSettingStatusRequest request
    ) {
        return ApiResponse.ok(settingsService.updateParamStatus(id, workspaceCode, request), "参数集状态更新成功");
    }

    @GetMapping("/params/{id}/references")
    public ApiResponse<ConfigReferenceModels.ConfigReferenceSummary> paramReferences(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(settingsService.paramReferences(id, workspaceCode));
    }

    @GetMapping("/params/{id}/change-history")
    public ApiResponse<PageResponse<ParamSetChangeHistoryItem>> listParamChangeHistory(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(settingsService.listParamChangeHistory(id, workspaceCode));
    }

    @GetMapping("/params/{id}/versions")
    public ApiResponse<PageResponse<ParamSetVersionItem>> listParamVersions(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(settingsService.listParamVersions(id, workspaceCode));
    }

    @PostMapping("/params/{id}/versions/{versionId}/rollback")
    public ApiResponse<ParamSetItem> rollbackParamVersion(
            @PathVariable Long id,
            @PathVariable Long versionId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(settingsService.rollbackParamVersion(id, versionId, workspaceCode), "参数集版本已回滚");
    }

    @DeleteMapping("/params/{id}")
    public ApiResponse<Void> deleteParam(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        settingsService.deleteParam(id, workspaceCode);
        return ApiResponse.ok(null, "参数集删除成功");
    }

    @GetMapping("/db-connections")
    public ApiResponse<PageResponse<DbConnectionItem>> listDbConnections(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "dbType", required = false) String dbType,
            @RequestParam(value = "status", required = false) Integer status
    ) {
        return ApiResponse.ok(settingsService.listDbConnections(workspaceCode, keyword, dbType, status));
    }

    @PostMapping("/db-connections")
    public ApiResponse<DbConnectionItem> createDbConnection(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody DbConnectionRequest request
    ) {
        return ApiResponse.ok(settingsService.createDbConnection(workspaceCode, request), "Database connection created");
    }

    @PutMapping("/db-connections/{id}")
    public ApiResponse<DbConnectionItem> updateDbConnection(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody DbConnectionRequest request
    ) {
        return ApiResponse.ok(settingsService.updateDbConnection(id, workspaceCode, request), "Database connection updated");
    }

    @PutMapping("/db-connections/{id}/status")
    public ApiResponse<DbConnectionItem> updateDbConnectionStatus(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody UpdateSettingStatusRequest request
    ) {
        return ApiResponse.ok(settingsService.updateDbConnectionStatus(id, workspaceCode, request), "Database connection status updated");
    }

    @DeleteMapping("/db-connections/{id}")
    public ApiResponse<Void> deleteDbConnection(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        settingsService.deleteDbConnection(id, workspaceCode);
        return ApiResponse.ok(null, "Database connection deleted");
    }

    @PostMapping("/db-connections/test")
    public ApiResponse<DbConnectionTestResult> testDbConnection(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody DbConnectionTestRequest request
    ) {
        return ApiResponse.ok(settingsService.testDbConnection(workspaceCode, request));
    }
}
