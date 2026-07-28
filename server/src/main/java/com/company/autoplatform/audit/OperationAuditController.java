package com.company.autoplatform.audit;

import com.company.autoplatform.common.ApiResponse;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceScope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit-logs")
public class OperationAuditController {

    private final OperationAuditLogService service;

    public OperationAuditController(OperationAuditLogService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<OperationAuditLogItem>> list(
            @RequestHeader(value = WorkspaceScope.HEADER, required = false) String workspaceCode,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "result", required = false) String result,
            @RequestParam(value = "pageNo", required = false) Long pageNo,
            @RequestParam(value = "pageSize", required = false) Long pageSize
    ) {
        return ApiResponse.ok(service.list(workspaceCode, keyword, category, result, pageNo, pageSize));
    }
}
