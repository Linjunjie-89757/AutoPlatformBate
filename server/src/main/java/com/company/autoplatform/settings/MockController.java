package com.company.autoplatform.settings;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
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

import java.util.List;

import static com.company.autoplatform.settings.MockModels.*;

@RestController
public class MockController {

    private final MockDomainService mockDomainService;

    public MockController(MockDomainService mockDomainService) {
        this.mockDomainService = mockDomainService;
    }

    @GetMapping("/api/settings/mock/applications")
    public ApiResponse<PageResponse<MockApplicationItem>> listApplications(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) Integer status
    ) {
        return ApiResponse.ok(mockDomainService.listApplications(workspaceCode, keyword, status));
    }

    @PostMapping("/api/settings/mock/applications")
    public ApiResponse<MockApplicationItem> createApplication(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockApplicationRequest request
    ) {
        return ApiResponse.ok(mockDomainService.createApplication(workspaceCode, request), "Mock 应用创建成功");
    }

    @PutMapping("/api/settings/mock/applications/{id}")
    public ApiResponse<MockApplicationItem> updateApplication(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockApplicationRequest request
    ) {
        return ApiResponse.ok(mockDomainService.updateApplication(id, workspaceCode, request), "Mock 应用更新成功");
    }

    @GetMapping("/api/settings/mock/applications/{id}/references")
    public ApiResponse<ConfigReferenceModels.ConfigReferenceSummary> applicationReferences(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(mockDomainService.applicationReferences(id, workspaceCode));
    }

    @DeleteMapping("/api/settings/mock/applications/{id}")
    public ApiResponse<Void> deleteApplication(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        mockDomainService.deleteApplication(id, workspaceCode);
        return ApiResponse.ok(null, "Mock 应用删除成功");
    }

    @GetMapping("/api/settings/mock/applications/{id}/releases")
    public ApiResponse<List<MockReleaseItem>> listReleases(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(mockDomainService.listReleases(id, workspaceCode));
    }

    @PostMapping("/api/settings/mock/applications/{id}/releases")
    public ApiResponse<MockReleaseItem> publishRelease(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestBody(required = false) MockReleaseRequest request
    ) {
        return ApiResponse.ok(mockDomainService.publishRelease(id, workspaceCode, request), "Mock 配置发布成功");
    }

    @PostMapping("/api/settings/mock/applications/{id}/releases/{releaseId}/activate")
    public ApiResponse<MockReleaseItem> activateRelease(
            @PathVariable Long id,
            @PathVariable Long releaseId,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        return ApiResponse.ok(mockDomainService.activateRelease(id, releaseId, workspaceCode), "Mock 发布版本已启用");
    }

    @GetMapping("/api/settings/mock/endpoints")
    public ApiResponse<PageResponse<MockEndpointItem>> listEndpoints(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "appId", required = false) Long appId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) Integer status
    ) {
        return ApiResponse.ok(mockDomainService.listEndpoints(workspaceCode, appId, keyword, status));
    }

    @PostMapping("/api/settings/mock/endpoints")
    public ApiResponse<MockEndpointItem> createEndpoint(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockEndpointRequest request
    ) {
        return ApiResponse.ok(mockDomainService.createEndpoint(workspaceCode, request), "Mock 接口创建成功");
    }

    @PutMapping("/api/settings/mock/endpoints/{id}")
    public ApiResponse<MockEndpointItem> updateEndpoint(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockEndpointRequest request
    ) {
        return ApiResponse.ok(mockDomainService.updateEndpoint(id, workspaceCode, request), "Mock 接口更新成功");
    }

    @DeleteMapping("/api/settings/mock/endpoints/{id}")
    public ApiResponse<Void> deleteEndpoint(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        mockDomainService.deleteEndpoint(id, workspaceCode);
        return ApiResponse.ok(null, "Mock 接口删除成功");
    }

    @GetMapping("/api/settings/mock/scenarios")
    public ApiResponse<PageResponse<MockScenarioItem>> listScenarios(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "endpointId", required = false) Long endpointId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) Integer status
    ) {
        return ApiResponse.ok(mockDomainService.listScenarios(workspaceCode, endpointId, keyword, status));
    }

    @PostMapping("/api/settings/mock/scenarios")
    public ApiResponse<MockScenarioItem> createScenario(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockScenarioRequest request
    ) {
        return ApiResponse.ok(mockDomainService.createScenario(workspaceCode, request), "Mock 场景创建成功");
    }

    @PutMapping("/api/settings/mock/scenarios/{id}")
    public ApiResponse<MockScenarioItem> updateScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockScenarioRequest request
    ) {
        return ApiResponse.ok(mockDomainService.updateScenario(id, workspaceCode, request), "Mock 场景更新成功");
    }

    @DeleteMapping("/api/settings/mock/scenarios/{id}")
    public ApiResponse<Void> deleteScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        mockDomainService.deleteScenario(id, workspaceCode);
        return ApiResponse.ok(null, "Mock 场景删除成功");
    }

    @GetMapping("/api/settings/mock/business-scenarios")
    public ApiResponse<PageResponse<MockBusinessScenarioItem>> listBusinessScenarios(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "appId", required = false) Long appId,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "status", required = false) Integer status
    ) {
        return ApiResponse.ok(mockDomainService.listBusinessScenarios(workspaceCode, appId, keyword, status));
    }

    @PostMapping("/api/settings/mock/business-scenarios")
    public ApiResponse<MockBusinessScenarioItem> createBusinessScenario(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockBusinessScenarioRequest request
    ) {
        return ApiResponse.ok(mockDomainService.createBusinessScenario(workspaceCode, request), "Mock 业务场景创建成功");
    }

    @PutMapping("/api/settings/mock/business-scenarios/{id}")
    public ApiResponse<MockBusinessScenarioItem> updateBusinessScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @Valid @RequestBody MockBusinessScenarioRequest request
    ) {
        return ApiResponse.ok(mockDomainService.updateBusinessScenario(id, workspaceCode, request), "Mock 业务场景更新成功");
    }

    @DeleteMapping("/api/settings/mock/business-scenarios/{id}")
    public ApiResponse<Void> deleteBusinessScenario(
            @PathVariable Long id,
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode
    ) {
        mockDomainService.deleteBusinessScenario(id, workspaceCode);
        return ApiResponse.ok(null, "Mock 业务场景删除成功");
    }

    @GetMapping("/api/settings/mock/call-logs")
    public ApiResponse<PageResponse<MockCallLogItem>> listCallLogs(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "appId", required = false) Long appId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioId
    ) {
        return ApiResponse.ok(mockDomainService.listCallLogs(workspaceCode, appId, scenarioId));
    }

    @RequestMapping("/api/mock/{appCode}/**")
    public ResponseEntity<String> invoke(
            @PathVariable String appCode,
            HttpServletRequest request,
            @RequestBody(required = false) String body
    ) {
        String prefix = request.getContextPath() + "/api/mock/" + appCode;
        String uri = request.getRequestURI();
        String mockPath = uri.startsWith(prefix) ? uri.substring(prefix.length()) : "/";
        if (mockPath.isBlank()) {
            mockPath = "/";
        }
        return mockDomainService.invoke(appCode, mockPath, request, body);
    }
}
