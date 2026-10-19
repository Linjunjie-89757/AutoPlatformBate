package com.company.autoplatform.settings;

import com.company.autoplatform.common.PageResponse;
import org.springframework.stereotype.Service;

@Service
public class SettingsService {

    private final DbConnectionDomainService dbConnectionDomainService;
    private final DbConnectionTestSupport dbConnectionTestSupport;
    private final SettingsEnvironmentDomainService environmentDomainService;
    private final SettingsParamSetDomainService paramSetDomainService;
    private final ConfigReferenceDomainService referenceDomainService;
    private final SettingsOverviewDomainService overviewDomainService;

    public SettingsService(
            DbConnectionDomainService dbConnectionDomainService,
            DbConnectionTestSupport dbConnectionTestSupport,
            SettingsEnvironmentDomainService environmentDomainService,
            SettingsParamSetDomainService paramSetDomainService,
            ConfigReferenceDomainService referenceDomainService,
            SettingsOverviewDomainService overviewDomainService
    ) {
        this.dbConnectionDomainService = dbConnectionDomainService;
        this.dbConnectionTestSupport = dbConnectionTestSupport;
        this.environmentDomainService = environmentDomainService;
        this.paramSetDomainService = paramSetDomainService;
        this.referenceDomainService = referenceDomainService;
        this.overviewDomainService = overviewDomainService;
    }

    public SettingsOverviewResponse overview(String workspaceCode) {
        return overviewDomainService.overview(workspaceCode);
    }

    public PageResponse<EnvConfigItem> listEnvs(String workspaceCode, String keyword, String envType, Integer status) {
        return environmentDomainService.listEnvs(workspaceCode, keyword, envType, status);
    }

    public EnvConfigItem createEnv(String headerWorkspaceCode, CreateEnvConfigRequest request) {
        return environmentDomainService.createEnv(headerWorkspaceCode, request);
    }

    public EnvConfigItem updateEnv(Long id, String headerWorkspaceCode, CreateEnvConfigRequest request) {
        return environmentDomainService.updateEnv(id, headerWorkspaceCode, request);
    }

    public EnvConfigItem updateEnvStatus(Long id, String workspaceCode, UpdateSettingStatusRequest request) {
        return environmentDomainService.updateEnvStatus(id, workspaceCode, request);
    }

    public void deleteEnv(Long id, String workspaceCode) {
        environmentDomainService.deleteEnv(id, workspaceCode);
    }

    public ConfigReferenceModels.ConfigReferenceSummary environmentReferences(Long id, String workspaceCode) {
        return referenceDomainService.environmentReferences(id, workspaceCode);
    }

    public PageResponse<ParamSetItem> listParams(String workspaceCode, String keyword, String paramType, Integer status) {
        return paramSetDomainService.listParams(workspaceCode, keyword, paramType, status);
    }

    public ParamSetItem createParam(String headerWorkspaceCode, CreateParamSetRequest request) {
        return paramSetDomainService.createParam(headerWorkspaceCode, request);
    }

    public ParamSetItem updateParam(Long id, String headerWorkspaceCode, CreateParamSetRequest request) {
        return paramSetDomainService.updateParam(id, headerWorkspaceCode, request);
    }

    public ParamSetItem updateParamStatus(Long id, String workspaceCode, UpdateSettingStatusRequest request) {
        return paramSetDomainService.updateParamStatus(id, workspaceCode, request);
    }

    public PageResponse<ParamSetChangeHistoryItem> listParamChangeHistory(Long id, String workspaceCode) {
        return paramSetDomainService.listChangeHistory(id, workspaceCode);
    }

    public PageResponse<ParamSetVersionItem> listParamVersions(Long id, String workspaceCode) {
        return paramSetDomainService.listVersions(id, workspaceCode);
    }

    public ParamSetItem rollbackParamVersion(Long id, Long versionId, String workspaceCode) {
        return paramSetDomainService.rollbackVersion(id, versionId, workspaceCode);
    }

    public void deleteParam(Long id, String workspaceCode) {
        paramSetDomainService.deleteParam(id, workspaceCode);
    }

    public ConfigReferenceModels.ConfigReferenceSummary paramReferences(Long id, String workspaceCode) {
        return referenceDomainService.paramReferences(id, workspaceCode);
    }

    public PageResponse<DbConnectionItem> listDbConnections(String workspaceCode, String keyword, String dbType, Integer status) {
        return dbConnectionDomainService.listDbConnections(workspaceCode, keyword, dbType, status);
    }

    public DbConnectionItem createDbConnection(String headerWorkspaceCode, DbConnectionRequest request) {
        return dbConnectionDomainService.createDbConnection(headerWorkspaceCode, request);
    }

    public DbConnectionItem updateDbConnection(Long id, String headerWorkspaceCode, DbConnectionRequest request) {
        return dbConnectionDomainService.updateDbConnection(id, headerWorkspaceCode, request);
    }

    public DbConnectionItem updateDbConnectionStatus(Long id, String workspaceCode, UpdateSettingStatusRequest request) {
        return dbConnectionDomainService.updateDbConnectionStatus(id, workspaceCode, request);
    }

    public void deleteDbConnection(Long id, String workspaceCode) {
        dbConnectionDomainService.deleteDbConnection(id, workspaceCode);
    }

    public DbConnectionTestResult testDbConnection(String workspaceCode, DbConnectionTestRequest request) {
        return dbConnectionTestSupport.testDbConnection(workspaceCode, request);
    }
}
