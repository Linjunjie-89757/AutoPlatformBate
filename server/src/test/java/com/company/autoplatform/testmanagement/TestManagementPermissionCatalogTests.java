package com.company.autoplatform.testmanagement;

import com.company.autoplatform.workspace.WorkspacePermissionCatalog;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TestManagementPermissionCatalogTests {

    private static final Set<String> ALL_TEST_MANAGEMENT_PERMISSIONS = Set.of(
            "test_management.view",
            "test_management.create",
            "test_management.edit",
            "test_management.delete",
            "test_management.review",
            "test_management.execute",
            "test_management.release",
            "test_management.force_release",
            "test_management.export"
    );

    @Test
    void catalogContainsCompleteTestManagementModule() {
        assertThat(WorkspacePermissionCatalog.allCodes()).containsAll(ALL_TEST_MANAGEMENT_PERMISSIONS);
        assertThat(WorkspacePermissionCatalog.modules())
                .filteredOn(module -> module.id().equals("test_management"))
                .singleElement()
                .satisfies(module -> assertThat(module.permissions())
                        .extracting(permission -> permission.code())
                        .containsExactlyInAnyOrderElementsOf(ALL_TEST_MANAGEMENT_PERMISSIONS));
    }

    @Test
    void defaultRolesReceiveContractedPermissions() {
        assertThat(WorkspacePermissionCatalog.defaultCodesForRole("SYSTEM_TEST_LEAD"))
                .containsAll(ALL_TEST_MANAGEMENT_PERMISSIONS);
        assertThat(WorkspacePermissionCatalog.defaultCodesForRole("SYSTEM_TEST_ENGINEER"))
                .contains(
                        "test_management.view",
                        "test_management.create",
                        "test_management.edit",
                        "test_management.execute",
                        "test_management.export"
                )
                .doesNotContain("test_management.delete", "test_management.review", "test_management.release", "test_management.force_release");
        assertThat(WorkspacePermissionCatalog.defaultCodesForRole("SYSTEM_DEVELOPER"))
                .contains("test_management.view");
        assertThat(WorkspacePermissionCatalog.defaultCodesForRole("SYSTEM_READ_ONLY"))
                .contains("test_management.view");
    }
}
