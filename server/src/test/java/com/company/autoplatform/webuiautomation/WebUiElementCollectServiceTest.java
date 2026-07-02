package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.ai.AiProviderClient;
import com.company.autoplatform.ai.AiProviderConnectionEntity;
import com.company.autoplatform.ai.AiProviderDomainService;
import com.company.autoplatform.ai.AiProviderRequestProfile;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.CollectWebUiElementsRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectCandidate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WebUiElementCollectServiceTest {

    private final WebUiElementCollectService service = new WebUiElementCollectService(WebUiElementAiEnhancer.noop());

    @Test
    void collectFromHtmlBuildsStableCandidates() {
        String html = """
                <main>
                  <form>
                    <h2>登录表单</h2>
                    <label for="username">用户名</label>
                    <input id="username" name="username" placeholder="请输入用户名">
                    <input data-testid="password-input" type="password" aria-label="密码">
                    <button type="submit">登录</button>
                  </form>
                  <table id="orderTable"><thead><tr><th>订单号</th></tr></thead></table>
                </main>
                """;

        var result = service.collect(collectRequest("登录页", "ALL", html));

        assertThat(result.candidates())
                .extracting(candidate -> candidate.elementName())
                .contains("用户名输入框", "密码输入框", "登录按钮", "orderTable表格");
        assertThat(result.candidates())
                .anySatisfy(candidate -> {
                    assertThat(candidate.elementName()).isEqualTo("密码输入框");
                    assertThat(candidate.locatorType()).isEqualTo("TEST_ID");
                    assertThat(candidate.locatorValue()).isEqualTo("password-input");
                    assertThat(candidate.groupName()).isEqualTo("筛选表单区");
                    assertThat(candidate.confidence()).isGreaterThanOrEqualTo(90);
                    assertThat(candidate.tagName()).isEqualTo("input");
                    assertThat(candidate.elementType()).isEqualTo("FORM");
                    assertThat(candidate.ariaLabel()).isEqualTo("密码");
                    assertThat(candidate.nearbyHeading()).isEqualTo("登录表单");
                    assertThat(candidate.businessMeaning()).isNull();
                    assertThat(candidate.recommendedToSave()).isTrue();
                    assertThat(candidate.validationStatus()).isEqualTo("SKIPPED");
                });
        assertThat(result.source()).isEqualTo("HTML");
    }

    @Test
    void collectScopeFiltersCandidates() {
        String html = """
                <section>
                  <input id="keyword" placeholder="关键字">
                  <button>查询</button>
                  <table class="result-table"></table>
                </section>
                """;

        var result = service.collect(collectRequest("查询页", "BUTTON", html));

        assertThat(result.candidates()).hasSize(1);
        assertThat(result.candidates().get(0).elementName()).isEqualTo("查询按钮");
    }

    @Test
    void collectEnhancesRuleCandidatesWithAiSuggestions() {
        WebUiElementCollectService enhancedService = new WebUiElementCollectService((candidates, request, source) -> {
            var original = candidates.get(0);
            return WebUiElementAiEnhancer.Result.enhanced(
                    List.of(new WebUiElementCollectCandidate(
                            "登录表单",
                            "账号输入框",
                            original.locatorType(),
                            original.locatorValue(),
                            original.framePath(),
                            original.shadowPath(),
                            original.locatorCandidates(),
                            98,
                            "AI 识别为登录账号字段，原始定位器稳定",
                            original.tagName(),
                            original.elementType(),
                            original.text(),
                            original.placeholder(),
                            original.ariaLabel(),
                            original.labelText(),
                            original.nearbyHeading(),
                            "用户登录账号",
                            true,
                            null,
                            "建议保留 id 或补充 data-testid",
                            "id 定位稳定",
                            original.validationStatus(),
                            original.matchCount(),
                            original.validationMessage(),
                            original.screenshotBase64(),
                            original.candidateSource(),
                            original.saveBlockedReason()
                    )),
                    "AI 已优化元素名称和分组"
            );
        });

        var result = enhancedService.collect(collectRequest("登录页", "FORM", "<input id=\"username\" placeholder=\"请输入用户名\">"));

        assertThat(result.aiEnhanced()).isTrue();
        assertThat(result.fallbackReason()).isNull();
        assertThat(result.message()).isEqualTo("AI 已优化元素名称和分组");
        assertThat(result.candidates()).singleElement().satisfies(candidate -> {
            assertThat(candidate.groupName()).isEqualTo("筛选表单区");
            assertThat(candidate.elementName()).isEqualTo("账号输入框");
            assertThat(candidate.locatorType()).isEqualTo("CSS");
            assertThat(candidate.locatorValue()).isEqualTo("#username");
            assertThat(candidate.confidence()).isEqualTo(98);
            assertThat(candidate.businessMeaning()).isEqualTo("用户登录账号");
            assertThat(candidate.recommendedToSave()).isTrue();
            assertThat(candidate.maintenanceSuggestion()).isEqualTo("建议保留 id 或补充 data-testid");
        });
    }

    @Test
    void collectFallsBackToRuleCandidatesWhenAiEnhancementFails() {
        WebUiElementCollectService enhancedService = new WebUiElementCollectService((candidates, request, source) ->
                WebUiElementAiEnhancer.Result.fallback(candidates, "未配置个人 AI 生成模型"));

        var result = enhancedService.collect(collectRequest("登录页", "FORM", "<input id=\"username\" placeholder=\"请输入用户名\">"));

        assertThat(result.aiEnhanced()).isFalse();
        assertThat(result.fallbackReason()).isEqualTo("未配置个人 AI 生成模型");
        assertThat(result.message()).isEqualTo("已生成规则候选元素，AI 增强未启用或失败");
        assertThat(result.candidates()).singleElement().satisfies(candidate -> {
            assertThat(candidate.elementName()).isEqualTo("用户名输入框");
            assertThat(candidate.locatorValue()).isEqualTo("#username");
        });
    }

    @Test
    void collectKeepsUnverifiedAiSupplementCandidatesOutOfSaveList() {
        WebUiElementCollectService enhancedService = new WebUiElementCollectService((candidates, request, source) -> {
            var supplement = new WebUiElementCollectCandidate(
                    "操作区",
                    "导出按钮",
                    "TEXT",
                    "导出",
                    null,
                    null,
                    null,
                    76,
                    "AI 根据页面语义推测存在导出按钮，但规则候选未采集到",
                    null,
                    "BUTTON",
                    "导出",
                    null,
                    null,
                    null,
                    null,
                    "导出列表数据",
                    true,
                    null,
                    "建议补充 data-testid 后再保存",
                    "AI 补充候选，需后端验证",
                    null,
                    null,
                    null,
                    null,
                    "AI_SUPPLEMENT",
                    null
            );
            return WebUiElementAiEnhancer.Result.enhanced(List.of(candidates.get(0), supplement), "AI 已补充可能漏采的候选元素");
        });

        var result = enhancedService.collect(collectRequest("查询页", "FORM", "<input id=\"keyword\" placeholder=\"请输入关键字\">"));

        assertThat(result.candidates())
                .filteredOn(candidate -> "AI_SUPPLEMENT".equals(candidate.candidateSource()))
                .singleElement()
                .satisfies(candidate -> {
                    assertThat(candidate.elementName()).isEqualTo("导出按钮");
                    assertThat(candidate.validationStatus()).isEqualTo("AI_UNVERIFIED");
                    assertThat(candidate.recommendedToSave()).isFalse();
                    assertThat(candidate.saveBlockedReason()).isEqualTo("AI 补充候选未完成后端验证，不能保存");
                });
    }

    @Test
    void defaultAiEnhancerKeepsAiSupplementLocatorsBlockedUntilValidation() {
        AiProviderDomainService aiProviderDomainService = mock(AiProviderDomainService.class);
        AiProviderClient aiProviderClient = mock(AiProviderClient.class);
        DefaultWebUiElementAiEnhancer enhancer = new DefaultWebUiElementAiEnhancer(aiProviderDomainService, aiProviderClient);
        AiProviderRequestProfile profile = new AiProviderRequestProfile(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "OPENAI_COMPATIBLE_CHAT",
                "test-model",
                "https://ai.example.test/v1",
                0.3,
                0.9,
                null,
                30
        );
        when(aiProviderDomainService.requireResolvedProviderModel(1L, "test-model"))
                .thenReturn(new AiProviderDomainService.ResolvedProviderModelConfig(new AiProviderConnectionEntity(), profile, "secret"));
        when(aiProviderClient.requestStructuredContent(any(), eq("secret"), any())).thenReturn("""
                {
                  "message": "AI 已完成候选元素命名、分组和漏采补充",
                  "candidates": [
                    {
                      "locatorType": "CSS",
                      "locatorValue": "#search",
                      "groupName": "筛选区",
                      "elementName": "订单搜索按钮",
                      "confidence": 96,
                      "reason": "按钮位于订单筛选区域，id 定位稳定",
                      "businessMeaning": "触发订单列表查询",
                      "recommendedToSave": true,
                      "maintenanceSuggestion": "建议保留 id 或补充 data-testid",
                      "stabilityNote": "id 定位稳定"
                    },
                    {
                      "locatorType": "CSS",
                      "locatorValue": "#ai-added",
                      "groupName": "操作区",
                      "elementName": "导出按钮",
                      "confidence": 90,
                      "reason": "AI 根据页面语义补充可能漏采的导出操作",
                      "businessMeaning": "导出订单列表",
                      "recommendedToSave": true,
                      "maintenanceSuggestion": "建议补充 data-testid 后再保存",
                      "stabilityNote": "AI 补充候选，需 Runner 真机验证",
                      "candidateSource": "AI_SUPPLEMENT"
                    }
                  ]
                }
                """);

        WebUiElementCollectCandidate original = candidate("页面元素", "搜索按钮", "CSS", "#search", 88);
        WebUiElementAiEnhancer.Result result = enhancer.enhance(
                List.of(original),
                collectRequest("订单页", "ALL", "<button id=\"search\">查询</button>"),
                "LOCAL_RUNNER_STATIC"
        );

        assertThat(result.enhanced()).isTrue();
        assertThat(result.candidates()).hasSize(2);
        assertThat(result.candidates())
                .filteredOn(candidate -> "#search".equals(candidate.locatorValue()))
                .singleElement()
                .satisfies(candidate -> {
            assertThat(candidate.groupName()).isEqualTo("筛选表单区");
            assertThat(candidate.elementName()).isEqualTo("订单搜索按钮");
            assertThat(candidate.locatorType()).isEqualTo("CSS");
            assertThat(candidate.locatorValue()).isEqualTo("#search");
            assertThat(candidate.businessMeaning()).isEqualTo("触发订单列表查询");
            assertThat(candidate.maintenanceSuggestion()).isEqualTo("建议保留 id 或补充 data-testid");
            assertThat(candidate.candidateSource()).isEqualTo("STATIC_RULE");
        });
        assertThat(result.candidates())
                .filteredOn(candidate -> "AI_SUPPLEMENT".equals(candidate.candidateSource()))
                .singleElement()
                .satisfies(candidate -> {
                    assertThat(candidate.groupName()).isEqualTo("操作按钮区");
                    assertThat(candidate.elementName()).isEqualTo("导出按钮");
                    assertThat(candidate.locatorType()).isEqualTo("CSS");
                    assertThat(candidate.locatorValue()).isEqualTo("#ai-added");
                    assertThat(candidate.validationStatus()).isEqualTo("AI_UNVERIFIED");
                    assertThat(candidate.recommendedToSave()).isFalse();
                    assertThat(candidate.saveBlockedReason()).isEqualTo("AI 补充候选需通过本地 Runner 验证后才能保存");
                });
    }

    private CollectWebUiElementsRequest collectRequest(String pageName, String scope, String html) {
        return new CollectWebUiElementsRequest(
                null,
                null,
                null,
                null,
                pageName,
                "AI",
                null,
                null,
                scope,
                html,
                null,
                null,
                null,
                null,
                1L,
                "test-model"
        );
    }

    private WebUiElementCollectCandidate candidate(String groupName, String elementName, String locatorType, String locatorValue, int confidence) {
        return new WebUiElementCollectCandidate(
                groupName,
                elementName,
                locatorType,
                locatorValue,
                null,
                null,
                null,
                confidence,
                "规则候选",
                "button",
                "BUTTON",
                "查询",
                null,
                null,
                null,
                null,
                null,
                true,
                null,
                "规则建议",
                "规则稳定性说明",
                "UNVERIFIED",
                null,
                "静态生成",
                null,
                "STATIC_RULE",
                null
        );
    }
}
