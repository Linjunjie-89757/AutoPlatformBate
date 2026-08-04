package com.company.autoplatform.settings;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DbConnectionServiceTests extends IntegrationTestSupport {

    @Autowired
    private SettingsService settingsService;

    @Autowired
    private DbConnectionMapper dbConnectionMapper;

    @Autowired
    private EnvConfigMapper envConfigMapper;

    @Autowired
    private ParamSetMapper paramSetMapper;

    @Autowired
    private ParamSetChangeHistoryMapper paramSetChangeHistoryMapper;

    @Test
    void settingsListsSupportOptionalFilters() {
        String unique = "settings-filter-" + System.nanoTime();

        EnvConfigItem env = settingsService.createEnv(WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                "STAGING",
                unique + "-env",
                "https://" + unique + ".example.com",
                "{\"description\":\"" + unique + "-env-desc\"}"
        ));

        ParamSetItem param = settingsService.createParam(WORKSPACE_CODE, new CreateParamSetRequest(
                null,
                "API",
                unique + "-param",
                "{\"value\":\"" + unique + "-value\",\"description\":\"filter target\"}"
        ));

        DbConnectionItem dbConnection = settingsService.createDbConnection(WORKSPACE_CODE, new DbConnectionRequest(
                null,
                unique + "-db",
                "H2",
                "org.h2.Driver",
                "jdbc:h2:mem:" + unique + "-filter;MODE=MySQL;DB_CLOSE_DELAY=-1",
                "sa",
                "secret",
                3,
                4000,
                unique + "-db-desc",
                0
        ));

        assertThat(settingsService.listEnvs(WORKSPACE_CODE, unique, "STAGING", 1).items())
                .extracting(EnvConfigItem::id)
                .contains(env.id());
        assertThat(settingsService.listEnvs(WORKSPACE_CODE, unique, "PROD", 1).items())
                .extracting(EnvConfigItem::id)
                .doesNotContain(env.id());

        assertThat(settingsService.listParams(WORKSPACE_CODE, unique, "API", 1).items())
                .extracting(ParamSetItem::id)
                .contains(param.id());
        assertThat(settingsService.listParams(WORKSPACE_CODE, unique, "GLOBAL", 1).items())
                .extracting(ParamSetItem::id)
                .doesNotContain(param.id());

        assertThat(settingsService.listDbConnections(WORKSPACE_CODE, unique, "H2", 0).items())
                .extracting(DbConnectionItem::id)
                .contains(dbConnection.id());
        assertThat(settingsService.listDbConnections(WORKSPACE_CODE, unique, "MYSQL", 1).items())
                .extracting(DbConnectionItem::id)
                .doesNotContain(dbConnection.id());

        settingsService.deleteEnv(env.id(), WORKSPACE_CODE);
        settingsService.deleteParam(param.id(), WORKSPACE_CODE);
        settingsService.deleteDbConnection(dbConnection.id(), WORKSPACE_CODE);
    }

    @Test
    void dbConnectionCrudDoesNotExposePasswordAndKeepsPasswordOnBlankUpdate() {
        String connectionName = "core-db-crud-" + System.nanoTime();
        DbConnectionItem created = settingsService.createDbConnection(WORKSPACE_CODE, new DbConnectionRequest(
                null,
                connectionName,
                "H2",
                "org.h2.Driver",
                "jdbc:h2:mem:" + connectionName + ";MODE=MySQL;DB_CLOSE_DELAY=-1",
                "sa",
                "secret",
                3,
                4000,
                "created by test",
                1
        ));

        assertThat(created.id()).isNotNull();
        assertThat(created.passwordConfigured()).isTrue();
        assertThat(created.workspaceCode()).isEqualTo(WORKSPACE_CODE);

        DbConnectionEntity stored = dbConnectionMapper.selectById(created.id());
        assertThat(stored.getPasswordEncrypted()).isNotBlank();
        assertThat(stored.getPasswordEncrypted()).isNotEqualTo("secret");

        DbConnectionTestResult testResult = settingsService.testDbConnection(WORKSPACE_CODE, new DbConnectionTestRequest(
                created.id(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                3000
        ));
        assertThat(testResult.success()).isTrue();

        DbConnectionItem updated = settingsService.updateDbConnection(created.id(), WORKSPACE_CODE, new DbConnectionRequest(
                null,
                connectionName + "-updated",
                "H2",
                "org.h2.Driver",
                stored.getJdbcUrl(),
                "sa",
                "",
                5,
                6000,
                "updated by test",
                1
        ));
        assertThat(updated.connectionName()).isEqualTo(connectionName + "-updated");
        assertThat(updated.passwordConfigured()).isTrue();

        DbConnectionEntity updatedStored = dbConnectionMapper.selectById(created.id());
        assertThat(updatedStored.getPasswordEncrypted()).isEqualTo(stored.getPasswordEncrypted());

        DbConnectionItem disabled = settingsService.updateDbConnectionStatus(
                created.id(),
                WORKSPACE_CODE,
                new UpdateSettingStatusRequest(0)
        );
        assertThat(disabled.status()).isZero();

        settingsService.deleteDbConnection(created.id(), WORKSPACE_CODE);
        assertThat(dbConnectionMapper.selectById(created.id())).isNull();
    }

    @Test
    void envAndParamCrudUpdatesStatusAndDeletesRecords() {
        String unique = "settings-crud-" + System.nanoTime();

        EnvConfigItem env = settingsService.createEnv(WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                "DEV",
                unique + "-env",
                "https://" + unique + ".example.com",
                "{\"token\":\"one\"}"
        ));
        assertThat(env.id()).isNotNull();
        assertThat(env.workspaceCode()).isEqualTo(WORKSPACE_CODE);
        assertThat(env.status()).isOne();

        EnvConfigItem updatedEnv = settingsService.updateEnv(env.id(), WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                "TEST",
                unique + "-env-updated",
                "https://" + unique + "-updated.example.com",
                "{\"token\":\"two\"}"
        ));
        assertThat(updatedEnv.envType()).isEqualTo("TEST");
        assertThat(updatedEnv.envName()).isEqualTo(unique + "-env-updated");
        assertThat(updatedEnv.configJson()).contains("two");

        EnvConfigItem disabledEnv = settingsService.updateEnvStatus(
                env.id(),
                WORKSPACE_CODE,
                new UpdateSettingStatusRequest(0)
        );
        assertThat(disabledEnv.status()).isZero();

        ParamSetItem param = settingsService.createParam(WORKSPACE_CODE, new CreateParamSetRequest(
                null,
                "API",
                unique + "-param",
                "{\"value\":\"one\"}"
        ));
        assertThat(param.id()).isNotNull();
        assertThat(param.workspaceCode()).isEqualTo(WORKSPACE_CODE);
        assertThat(param.status()).isOne();

        ParamSetItem updatedParam = settingsService.updateParam(param.id(), WORKSPACE_CODE, new CreateParamSetRequest(
                null,
                "GLOBAL",
                unique + "-param-updated",
                "{\"value\":\"two\"}"
        ));
        assertThat(updatedParam.paramType()).isEqualTo("GLOBAL");
        assertThat(updatedParam.paramName()).isEqualTo(unique + "-param-updated");
        assertThat(updatedParam.contentJson()).contains("two");

        ParamSetItem disabledParam = settingsService.updateParamStatus(
                param.id(),
                WORKSPACE_CODE,
                new UpdateSettingStatusRequest(0)
        );
        assertThat(disabledParam.status()).isZero();

        settingsService.deleteEnv(env.id(), WORKSPACE_CODE);
        settingsService.deleteParam(param.id(), WORKSPACE_CODE);
        assertThat(envConfigMapper.selectById(env.id())).isNull();
        assertThat(paramSetMapper.selectById(param.id())).isNull();
    }

    @Test
    void envCreateDefaultsBlankTypeToTestGroup() {
        String unique = "settings-env-default-type-" + System.nanoTime();

        EnvConfigItem env = settingsService.createEnv(WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                " ",
                unique + "-env",
                "https://" + unique + ".example.com",
                "{\"description\":\"default group\"}"
        ));

        assertThat(env.envType()).isEqualTo("TEST");

        settingsService.deleteEnv(env.id(), WORKSPACE_CODE);
    }

    @Test
    void envCreateAllowsBaseUrlToBeConfiguredAfterCreation() {
        String unique = "settings-env-empty-base-url-" + System.nanoTime();

        EnvConfigItem created = settingsService.createEnv(WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                "TEST",
                unique + "-env",
                " ",
                "{\"scopeType\":\"API\"}"
        ));

        assertThat(created.baseUrl()).isEmpty();

        EnvConfigItem updated = settingsService.updateEnv(created.id(), WORKSPACE_CODE, new CreateEnvConfigRequest(
                null,
                "TEST",
                unique + "-env",
                " https://api.example.com ",
                created.configJson()
        ));

        assertThat(updated.baseUrl()).isEqualTo("https://api.example.com");

        settingsService.deleteEnv(created.id(), WORKSPACE_CODE);
    }

    @Test
    void paramSetChangesAreRecordedForCreateUpdateAndStatus() {
        String unique = "settings-param-history-" + System.nanoTime();

        ParamSetItem created = settingsService.createParam(WORKSPACE_CODE, new CreateParamSetRequest(
                null,
                "API_VARIABLE_SET",
                unique + "-param",
                "{\"variables\":[{\"name\":\"token\",\"value\":\"one\"}]}"
        ));
        ParamSetItem updated = settingsService.updateParam(created.id(), WORKSPACE_CODE, new CreateParamSetRequest(
                null,
                "API_VARIABLE_SET",
                unique + "-param-updated",
                "{\"variables\":[{\"name\":\"token\",\"value\":\"two\"}]}"
        ));
        settingsService.updateParamStatus(created.id(), WORKSPACE_CODE, new UpdateSettingStatusRequest(0));

        PageResponse<ParamSetChangeHistoryItem> page = settingsService.listParamChangeHistory(created.id(), WORKSPACE_CODE);

        assertThat(updated.paramName()).isEqualTo(unique + "-param-updated");
        assertThat(page.items())
                .extracting(ParamSetChangeHistoryItem::changeType)
                .containsExactly("STATUS", "UPDATE", "CREATE");
        assertThat(page.items().get(1).changedFields()).contains("paramName", "contentJson");
        assertThat(page.items().get(1).operatorName()).isEqualTo("Zhang Li");
        assertThat(paramSetChangeHistoryMapper.selectList(null))
                .extracting(ParamSetChangeHistoryEntity::getParamSetId)
                .contains(created.id());

        settingsService.deleteParam(created.id(), WORKSPACE_CODE);
    }

    @Test
    void paramSetVersionsAreRecordedAndRollbackCreatesNewVersion() {
        String unique = "settings-param-version-" + System.nanoTime();

        ParamSetItem created = settingsService.createParam(WORKSPACE_CODE, new CreateParamSetRequest(
                null,
                "API_VARIABLE_SET",
                unique + "-param",
                "{\"variables\":[{\"name\":\"token\",\"value\":\"one\"}]}"
        ));
        settingsService.updateParam(created.id(), WORKSPACE_CODE, new CreateParamSetRequest(
                null,
                "API_VARIABLE_SET",
                unique + "-param-updated",
                "{\"variables\":[{\"name\":\"token\",\"value\":\"two\"}]}"
        ));

        PageResponse<ParamSetVersionItem> versions = settingsService.listParamVersions(created.id(), WORKSPACE_CODE);

        assertThat(versions.items())
                .extracting(ParamSetVersionItem::versionNo)
                .containsExactly(2, 1);
        assertThat(versions.items().get(0).latest()).isTrue();
        assertThat(versions.items().get(1).contentJson()).contains("\"one\"");

        ParamSetItem rolledBack = settingsService.rollbackParamVersion(created.id(), versions.items().get(1).id(), WORKSPACE_CODE);
        PageResponse<ParamSetVersionItem> afterRollback = settingsService.listParamVersions(created.id(), WORKSPACE_CODE);

        assertThat(rolledBack.paramName()).isEqualTo(unique + "-param");
        assertThat(rolledBack.contentJson()).contains("\"one\"");
        assertThat(afterRollback.items())
                .extracting(ParamSetVersionItem::versionNo)
                .containsExactly(3, 2, 1);
        assertThat(afterRollback.items().get(0).changeType()).isEqualTo("ROLLBACK");
        assertThat(afterRollback.items().get(0).latest()).isTrue();

        settingsService.deleteParam(created.id(), WORKSPACE_CODE);
    }

    @Test
    void dbConnectionTestFailureKeepsExistingExceptionSemantics() {
        assertThatThrownBy(() -> settingsService.testDbConnection(WORKSPACE_CODE, new DbConnectionTestRequest(
                null,
                null,
                null,
                "H2",
                "com.example.MissingDriver",
                "jdbc:h2:mem:missing-driver;MODE=MySQL",
                "sa",
                "",
                1000
        )))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("JDBC driver is not available");

        assertThatThrownBy(() -> settingsService.testDbConnection(WORKSPACE_CODE, new DbConnectionTestRequest(
                null,
                null,
                null,
                "H2",
                "org.h2.Driver",
                "",
                "sa",
                "",
                1000
        )))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("JDBC URL cannot be blank");
    }
}
