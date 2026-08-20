package com.company.autoplatform.config;

import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.company.autoplatform.workspace.WorkspaceScope;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class WorkspacePermissionAccessInterceptorTests {

    @ParameterizedTest
    @CsvSource({
            "GET, /api/test-management/versions, test_management.view",
            "POST, /api/test-management/versions, test_management.create",
            "PUT, /api/test-management/requirements/1, test_management.edit",
            "DELETE, /api/test-management/requirements/1, test_management.delete",
            "POST, /api/test-management/requirements/1/review/start, test_management.review",
            "POST, /api/test-management/plans/1/cases/2/results, test_management.execute",
            "POST, /api/test-management/plans/1/report/generate, test_management.execute",
            "POST, /api/test-management/plans/1/cases/2/defects, test_management.execute",
            "POST, /api/test-management/versions/1/transition, test_management.release",
            "GET, /api/test-management/plans/1/report/pdf, test_management.export",
            "GET, /api/test-management/versions/1/report/pdf, test_management.export",
            "DELETE, /api/test-management/plans/1/cases/2, test_management.edit"
    })
    void mapsTestManagementRoutesToExpectedPermission(String method, String uri, String expectedPermission) {
        WorkspaceAccessSupport workspaceAccessSupport = mock(WorkspaceAccessSupport.class);
        WorkspacePermissionAccessInterceptor interceptor = new WorkspacePermissionAccessInterceptor(workspaceAccessSupport);
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.addHeader(WorkspaceScope.HEADER, "risk-ops");

        interceptor.preHandle(request, new MockHttpServletResponse(), new Object());

        verify(workspaceAccessSupport).requirePermission("risk-ops", expectedPermission);
    }
}
