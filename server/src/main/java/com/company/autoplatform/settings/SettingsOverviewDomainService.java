package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.company.autoplatform.notification.NotificationChannelMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class SettingsOverviewDomainService {

    private final DbConnectionMapper dbConnectionMapper;
    private final EnvConfigMapper envConfigMapper;
    private final ParamSetMapper paramSetMapper;
    private final NotificationChannelMapper notificationChannelMapper;
    private final WorkspaceService workspaceService;

    public SettingsOverviewDomainService(
            DbConnectionMapper dbConnectionMapper,
            EnvConfigMapper envConfigMapper,
            ParamSetMapper paramSetMapper,
            NotificationChannelMapper notificationChannelMapper,
            WorkspaceService workspaceService
    ) {
        this.dbConnectionMapper = dbConnectionMapper;
        this.envConfigMapper = envConfigMapper;
        this.paramSetMapper = paramSetMapper;
        this.notificationChannelMapper = notificationChannelMapper;
        this.workspaceService = workspaceService;
    }

    public SettingsOverviewResponse overview(String workspaceCode) {
        Scope scope = resolveScope(workspaceCode);
        if (scope.workspaceIds().isEmpty() && scope.workspaceId() == null && !scope.unrestricted()) {
            SettingsOverviewResponse.CountMetric empty = new SettingsOverviewResponse.CountMetric(0, 0);
            return new SettingsOverviewResponse(empty, empty, empty, empty);
        }
        return new SettingsOverviewResponse(
                count(dbConnectionMapper, scope),
                count(envConfigMapper, scope),
                count(notificationChannelMapper, scope),
                count(paramSetMapper, scope)
        );
    }

    private <T> SettingsOverviewResponse.CountMetric count(BaseMapper<T> mapper, Scope scope) {
        QueryWrapper<T> query = new QueryWrapper<>();
        if (scope.workspaceId() != null) {
            query.eq("workspace_id", scope.workspaceId());
        } else if (!scope.unrestricted()) {
            query.in("workspace_id", scope.workspaceIds());
        }
        List<Map<String, Object>> rows = mapper.selectMaps(query
                .select("status", "COUNT(*) AS item_count")
                .groupBy("status"));
        long total = 0;
        long enabled = 0;
        for (Map<String, Object> row : rows) {
            long count = numericValue(row.get("item_count"));
            total += count;
            if ("1".equals(String.valueOf(row.get("status")))) {
                enabled += count;
            }
        }
        return new SettingsOverviewResponse.CountMetric(total, enabled);
    }

    private Scope resolveScope(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        if (!WorkspaceScope.isAll(normalized)) {
            WorkspaceEntity workspace = workspaceService.requireReadableWorkspace(normalized);
            return new Scope(workspace.getId(), List.of(), false);
        }
        if (workspaceService.isPlatformAdmin()) {
            return new Scope(null, List.of(), true);
        }
        return new Scope(null, workspaceService.listReadableWorkspaceIds(), false);
    }

    private long numericValue(Object value) {
        return value instanceof Number number
                ? number.longValue()
                : Long.parseLong(String.valueOf(value));
    }

    private record Scope(Long workspaceId, List<Long> workspaceIds, boolean unrestricted) {
    }
}
