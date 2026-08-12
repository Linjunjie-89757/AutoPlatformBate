package com.company.autoplatform.workspace;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class WorkspacePermissionCatalog {

    private static final List<WorkspacePermissionModuleItem> MODULES = List.of(
            module("cases", "用例中心",
                    permission("cases.view", "view", "查看", false),
                    permission("cases.create", "create", "新建", false),
                    permission("cases.edit", "edit", "编辑", false),
                    permission("cases.delete", "delete", "删除", true),
                    permission("cases.execute", "execute", "执行", false),
                    permission("cases.export", "export", "导出", false)),
            module("api", "接口自动化",
                    permission("api.view", "view", "查看", false),
                    permission("api.create", "create", "新建", false),
                    permission("api.edit", "edit", "编辑", false),
                    permission("api.delete", "delete", "删除", true),
                    permission("api.execute", "execute", "执行", false),
                    permission("api.export", "export", "导出", false)),
            module("webui", "Web UI 自动化",
                    permission("webui.view", "view", "查看", false),
                    permission("webui.create", "create", "新建", false),
                    permission("webui.edit", "edit", "编辑", false),
                    permission("webui.delete", "delete", "删除", true),
                    permission("webui.execute", "execute", "执行", false)),
            module("bugs", "缺陷管理",
                    permission("bugs.view", "view", "查看", false),
                    permission("bugs.create", "create", "新建", false),
                    permission("bugs.edit", "edit", "编辑", false),
                    permission("bugs.delete", "delete", "删除", true),
                    permission("bugs.review", "review", "审核", true)),
            module("config", "配置中心",
                    permission("config.view", "view", "查看", false),
                    permission("config.manage", "manage", "配置", true)),
            module("reports", "报告中心",
                    permission("reports.view", "view", "查看", false),
                    permission("reports.edit", "edit", "编辑", false),
                    permission("reports.delete", "delete", "删除", true),
                    permission("reports.export", "export", "导出", false),
                    permission("reports.share", "share", "分享", true)),
            module("tasks", "任务中心",
                    permission("tasks.view", "view", "查看", false),
                    permission("tasks.create", "create", "新建", false),
                    permission("tasks.edit", "edit", "编辑", false),
                    permission("tasks.delete", "delete", "删除", true),
                    permission("tasks.execute", "execute", "执行", false))
    );

    private static final Set<String> ALL_CODES = MODULES.stream()
            .flatMap(module -> module.permissions().stream())
            .map(WorkspacePermissionItem::code)
            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

    private static final Set<String> TEST_ENGINEER_CODES = Set.of(
            "cases.view", "cases.create", "cases.edit", "cases.execute",
            "api.view", "api.create", "api.edit", "api.execute",
            "webui.view", "webui.create", "webui.edit", "webui.execute",
            "bugs.view", "bugs.create", "bugs.edit",
            "config.view",
            "reports.view", "reports.export",
            "tasks.view", "tasks.create", "tasks.edit", "tasks.execute"
    );

    private static final Set<String> DEVELOPER_CODES = Set.of(
            "cases.view",
            "api.view", "api.execute",
            "webui.view",
            "bugs.view", "bugs.edit",
            "reports.view",
            "tasks.view"
    );

    private static final Set<String> READ_ONLY_CODES = Set.of(
            "cases.view",
            "api.view",
            "webui.view",
            "reports.view"
    );

    private WorkspacePermissionCatalog() {
    }

    public static List<WorkspacePermissionModuleItem> modules() {
        return MODULES;
    }

    public static List<String> allCodes() {
        return List.copyOf(ALL_CODES);
    }

    public static boolean contains(String permissionCode) {
        return ALL_CODES.contains(permissionCode);
    }

    public static List<String> defaultCodesForRole(String roleCode) {
        if (WorkspaceRoleDomainService.SYSTEM_TEST_LEAD.equals(roleCode)) {
            return allCodes();
        }
        if (WorkspaceRoleDomainService.SYSTEM_TEST_ENGINEER.equals(roleCode)) {
            return ALL_CODES.stream().filter(TEST_ENGINEER_CODES::contains).toList();
        }
        if (WorkspaceRoleDomainService.SYSTEM_DEVELOPER.equals(roleCode)) {
            return ALL_CODES.stream().filter(DEVELOPER_CODES::contains).toList();
        }
        if (WorkspaceRoleDomainService.SYSTEM_READ_ONLY.equals(roleCode)) {
            return ALL_CODES.stream().filter(READ_ONLY_CODES::contains).toList();
        }
        return List.of();
    }

    private static WorkspacePermissionModuleItem module(
            String id,
            String label,
            WorkspacePermissionItem... permissions
    ) {
        return new WorkspacePermissionModuleItem(id, label, List.of(permissions));
    }

    private static WorkspacePermissionItem permission(
            String code,
            String action,
            String label,
            boolean risky
    ) {
        return new WorkspacePermissionItem(code, action, label, risky);
    }
}
