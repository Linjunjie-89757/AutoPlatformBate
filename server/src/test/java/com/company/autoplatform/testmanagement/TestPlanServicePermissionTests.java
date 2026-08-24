package com.company.autoplatform.testmanagement;

import com.company.autoplatform.bug.BugMapper;
import com.company.autoplatform.bug.BugService;
import com.company.autoplatform.casecenter.CaseMapper;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.user.UserService;
import com.company.autoplatform.workspace.WorkspaceAccessSupport;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class TestPlanServicePermissionTests {

    @Mock private TestPlanMapper planMapper;
    @Mock private TestPlanRequirementMapper planRequirementMapper;
    @Mock private TestPlanCaseMapper planCaseMapper;
    @Mock private TestPlanCaseRequirementMapper planCaseRequirementMapper;
    @Mock private TestPlanCaseExecutionMapper executionMapper;
    @Mock private TestPlanCaseDefectRelationMapper planCaseDefectRelationMapper;
    @Mock private TestPlanExecutionAttachmentMapper executionAttachmentMapper;
    @Mock private TestPlanExecutionAttachmentStorageService executionAttachmentStorageService;
    @Mock private TestPlanReportMapper reportMapper;
    @Mock private TestRequirementMapper requirementMapper;
    @Mock private TestRequirementCaseMapper requirementCaseMapper;
    @Mock private TestVersionMapper versionMapper;
    @Mock private CaseMapper caseMapper;
    @Mock private BugMapper bugMapper;
    @Mock private UserMapper userMapper;
    @Mock private UserService userService;
    @Mock private BugService bugService;
    @Mock private ObjectMapper objectMapper;
    @Mock private TestManagementWorkspaceSupport workspaceSupport;
    @Mock private WorkspaceAccessSupport workspaceAccessSupport;
    @Mock private TestActivityLogService activityLogService;
    @Mock private TestPlanPdfReportService pdfReportService;

    @InjectMocks
    private TestPlanService service;

    @Test
    void createAndStartRequiresExecutePermissionBeforeWritingPlan() {
        CreateTestPlanRequest request = new CreateTestPlanRequest(
                PlanPurpose.VERSION,
                PlanType.REGRESSION,
                1L,
                "permission-boundary-plan",
                11L,
                LocalDate.of(2026, 8, 24),
                LocalDate.of(2026, 8, 25),
                null,
                null,
                null,
                false,
                0,
                true,
                true,
                List.of(1L),
                List.of(),
                List.of(),
                false
        );
        doThrow(new AccessDeniedException("missing execute permission"))
                .when(workspaceAccessSupport)
                .requirePermission("risk-ops", "test_management.execute");

        assertThatThrownBy(() -> service.createAndStart("risk-ops", request))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(planMapper, planRequirementMapper, planCaseMapper, activityLogService);
    }
}
