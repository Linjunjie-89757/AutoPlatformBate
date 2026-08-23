package com.company.autoplatform.testmanagement;

import com.company.autoplatform.IntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TestManagementMigrationTests extends IntegrationTestSupport {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migrationCreatesTestManagementTablesAndBugTraceColumns() {
        assertThat(existingTables()).contains(
                "tb_test_version",
                "tb_test_requirement",
                "tb_test_requirement_case",
                "tb_test_plan",
                "tb_test_plan_requirement",
                "tb_test_plan_case",
                "tb_test_plan_case_requirement",
                "tb_test_plan_case_execution",
                "tb_test_plan_report",
                "tb_test_activity_log"
        );
        assertThat(columnsOf("tb_bug_info")).contains(
                "test_version_id",
                "test_requirement_id",
                "test_plan_id",
                "test_plan_case_id"
        );
    }

    @Test
    void migrationRegistersPermissionsAndDefaultRoleBindings() {
        List<String> permissionCodes = jdbcTemplate.queryForList("""
                SELECT permission_code
                FROM tb_sys_permission
                WHERE module_code = 'test_management'
                ORDER BY permission_code
                """, String.class);
        assertThat(permissionCodes).containsExactlyInAnyOrder(
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

        assertThat(rolePermissions("SYSTEM_TEST_LEAD")).containsAll(permissionCodes);
        assertThat(rolePermissions("SYSTEM_TEST_ENGINEER")).containsExactlyInAnyOrder(
                "test_management.view",
                "test_management.create",
                "test_management.edit",
                "test_management.execute",
                "test_management.export"
        );
        assertThat(rolePermissions("SYSTEM_DEVELOPER")).contains("test_management.view");
        assertThat(rolePermissions("SYSTEM_READ_ONLY")).contains("test_management.view");
    }

    private List<String> existingTables() {
        return jdbcTemplate.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                """, String.class);
    }

    private List<String> columnsOf(String tableName) {
        return jdbcTemplate.queryForList("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ?
                """, String.class, tableName);
    }

    private List<String> rolePermissions(String roleCode) {
        return jdbcTemplate.queryForList("""
                SELECT DISTINCT binding.permission_code
                FROM tb_sys_workspace_role_permission binding
                JOIN tb_sys_workspace_role role_definition ON role_definition.id = binding.role_id
                WHERE role_definition.role_code = ?
                  AND binding.permission_code LIKE 'test_management.%'
                """, String.class, roleCode);
    }
}
