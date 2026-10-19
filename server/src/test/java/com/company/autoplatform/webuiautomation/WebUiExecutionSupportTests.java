package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebUiExecutionSupportTests {

    private final WebUiLocatorSupport locatorSupport = new WebUiLocatorSupport();

    @Test
    void resolveUrlUsesAbsoluteInputDirectly() {
        assertThat(WebUiExecutionEngineSupport.resolveOpenUrl("https://example.com/login", "https://base.test"))
                .isEqualTo("https://example.com/login");
    }

    @Test
    void resolveUrlCombinesBaseUrlAndRelativePath() {
        assertThat(WebUiExecutionEngineSupport.resolveOpenUrl("/login", "https://base.test/app"))
                .isEqualTo("https://base.test/login");
    }

    @Test
    void resolveUrlRejectsRelativePathWithoutBaseUrl() {
        assertThatThrownBy(() -> WebUiExecutionEngineSupport.resolveOpenUrl("/login", null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Base URL");
    }

    @Test
    void parseRoleLocatorRequiresRoleAndName() {
        WebUiLocatorSupport.RoleLocator locator = locatorSupport.parseRoleLocator("button:Login");

        assertThat(locator.role()).isEqualTo("button");
        assertThat(locator.name()).isEqualTo("Login");
    }

    @Test
    void parseRoleLocatorRejectsInvalidFormat() {
        assertThatThrownBy(() -> locatorSupport.parseRoleLocator("button"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ROLE locator");
    }

    @Test
    void normalizeStepTypeAcceptsHighFrequencyWebUiSteps() {
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("hover")).isEqualTo("HOVER");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("double_click")).isEqualTo("DOUBLE_CLICK");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("right_click")).isEqualTo("RIGHT_CLICK");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("press_key")).isEqualTo("PRESS_KEY");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("select")).isEqualTo("SELECT");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("file_upload")).isEqualTo("FILE_UPLOAD");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("assert_url")).isEqualTo("ASSERT_URL");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("assert_title")).isEqualTo("ASSERT_TITLE");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("assert_attribute")).isEqualTo("ASSERT_ATTRIBUTE");
        assertThat(WebUiAutomationFormatSupport.normalizeStepType("assert_count")).isEqualTo("ASSERT_COUNT");
    }

    @Test
    void validateStepRequirementsCoversHighFrequencyWebUiSteps() {
        assertThatThrownBy(() -> WebUiAutomationFormatSupport.validateStepRequirements("HOVER", null, null, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Locator is required");
        assertThatThrownBy(() -> WebUiAutomationFormatSupport.validateStepRequirements("SELECT", "CSS", "#status", null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Input value is required");
        assertThatThrownBy(() -> WebUiAutomationFormatSupport.validateStepRequirements("ASSERT_URL", null, null, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Input value is required");
        assertThatThrownBy(() -> WebUiAutomationFormatSupport.validateStepRequirements("ASSERT_COUNT", "CSS", ".row", null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Input value is required");

        WebUiAutomationFormatSupport.validateStepRequirements("PRESS_KEY", null, null, "Control+A");
        WebUiAutomationFormatSupport.validateStepRequirements("ASSERT_TITLE", null, null, "Dashboard");
        WebUiAutomationFormatSupport.validateStepRequirements("FILE_UPLOAD", "CSS", "input[type=file]", "D:/tmp/a.txt");
    }

    @Test
    void parseAttributeExpectationRequiresAttributeNameAndExpectedValue() {
        WebUiExecutionEngineSupport.AttributeExpectation expectation =
                WebUiExecutionEngineSupport.parseAttributeExpectation("aria-label=Submit");

        assertThat(expectation.name()).isEqualTo("aria-label");
        assertThat(expectation.expectedValue()).isEqualTo("Submit");
    }

    @Test
    void parseAttributeExpectationRejectsInvalidFormat() {
        assertThatThrownBy(() -> WebUiExecutionEngineSupport.parseAttributeExpectation("disabled"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ASSERT_ATTRIBUTE");
    }

    @Test
    void matchesCountExpectationSupportsCommonOperators() {
        assertThat(WebUiExecutionEngineSupport.matchesCountExpectation(2, "=2")).isTrue();
        assertThat(WebUiExecutionEngineSupport.matchesCountExpectation(2, ">1")).isTrue();
        assertThat(WebUiExecutionEngineSupport.matchesCountExpectation(2, "<3")).isTrue();
        assertThat(WebUiExecutionEngineSupport.matchesCountExpectation(2, "2")).isTrue();
        assertThat(WebUiExecutionEngineSupport.matchesCountExpectation(2, "=3")).isFalse();
    }

    @Test
    void matchesCountExpectationRejectsInvalidExpression() {
        assertThatThrownBy(() -> WebUiExecutionEngineSupport.matchesCountExpectation(2, "many"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ASSERT_COUNT");
    }

    @Test
    void replaceVariablesSupportsEscapingAndRejectsMissingVariables() {
        WebUiExecutionContextSupport support = new WebUiExecutionContextSupport();
        Map<String, WebUiExecutionContextSupport.RuntimeVariable> variables = Map.of(
                "USERNAME", new WebUiExecutionContextSupport.RuntimeVariable("admin", false),
                "PASSWORD", new WebUiExecutionContextSupport.RuntimeVariable("secret", true)
        );

        assertThat(support.replaceVariables("login/{{USERNAME}}/\\{{PASSWORD}}", variables))
                .isEqualTo("login/admin/{{PASSWORD}}");
        assertThatThrownBy(() -> support.replaceVariables("{{MISSING}}", variables))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Missing Web UI variable: MISSING");
    }

    @Test
    void mergeVariablesUsesLaterValuesAndKeepsSensitiveFlag() {
        WebUiExecutionContextSupport support = new WebUiExecutionContextSupport();

        Map<String, WebUiExecutionContextSupport.RuntimeVariable> merged = support.mergeVariables(
                Map.of("TOKEN", new WebUiExecutionContextSupport.RuntimeVariable("built-in", false)),
                List.of(new WebUiExecutionContextSupport.VariableItem("TOKEN", "env", false, "env token"),
                        new WebUiExecutionContextSupport.VariableItem("PASSWORD", "env-secret", true, null)),
                List.of(new WebUiExecutionContextSupport.VariableItem("TOKEN", "set", false, "set token")),
                Map.of("TOKEN", "runtime")
        );

        assertThat(merged.get("TOKEN").value()).isEqualTo("runtime");
        assertThat(merged.get("TOKEN").sensitive()).isFalse();
        assertThat(merged.get("PASSWORD").value()).isEqualTo("env-secret");
        assertThat(merged.get("PASSWORD").sensitive()).isTrue();
    }

    @Test
    void readEnvironmentConfigAcceptsLegacyLocalVariablesAlias() {
        WebUiExecutionContextSupport support = new WebUiExecutionContextSupport();

        WebUiExecutionContextSupport.WebUiEnvironmentConfig config = support.readEnvironmentConfig("""
                {
                  "webUIConfig": {"entryUrl": "https://web.test/login", "enabled": true},
                  "localVariables": [{"name": "TENANT", "value": "legacy", "sensitive": false}],
                  "variableSetIds": [11, 12],
                  "disabledVariableSetIds": [12]
                }
                """);

        assertThat(config.webUIConfig().entryUrl()).isEqualTo("https://web.test/login");
        assertThat(config.variables()).extracting(WebUiExecutionContextSupport.VariableItem::name)
                .containsExactly("TENANT");
        assertThat(config.variableSetIds()).containsExactly(11L, 12L);
        assertThat(config.disabledVariableSetIds()).containsExactly(12L);
    }

    @Test
    void maskVariablesHidesSensitiveValues() {
        WebUiExecutionContextSupport support = new WebUiExecutionContextSupport();

        Map<String, String> masked = support.maskVariables(Map.of(
                "USERNAME", new WebUiExecutionContextSupport.RuntimeVariable("admin", false),
                "PASSWORD", new WebUiExecutionContextSupport.RuntimeVariable("secret", true)
        ));

        assertThat(masked).containsEntry("USERNAME", "admin");
        assertThat(masked).containsEntry("PASSWORD", "******");
    }

    @Test
    void buildFailureMessageIncludesStepEvidenceForReadableReports() {
        WebUiPlaywrightBrowserRunner runner = new WebUiPlaywrightBrowserRunner(locatorSupport);
        WebUiCaseStepEntity step = new WebUiCaseStepEntity();
        step.setStepName("Click login");
        step.setStepType("CLICK");
        step.setLocatorType("CSS");
        step.setLocatorValue("#login");
        step.setInputValue("alice");
        step.setTimeoutMs(3000);
        step.setSortOrder(2);

        String message = runner.buildFailureMessage(step, new BadRequestException("Locator not found: #login"));

        assertThat(message)
                .contains("定位器未找到或不可用")
                .contains("第 2 步")
                .contains("Click login")
                .contains("CLICK")
                .contains("CSS: #login")
                .contains("输入/目标：alice")
                .contains("超时：3000 ms")
                .contains("Locator not found: #login");
    }
}
