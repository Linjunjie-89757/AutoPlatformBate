package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.ai.AiProviderClient;
import com.company.autoplatform.ai.AiProviderDomainService;
import com.company.autoplatform.ai.AiProviderRequestProfile;
import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.CollectWebUiElementsRequest;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiElementCollectCandidate;

@Component
class DefaultWebUiElementAiEnhancer implements WebUiElementAiEnhancer {

    private static final int MAX_AI_CANDIDATES = 80;
    private static final int MAX_AI_SUPPLEMENT_CANDIDATES = 10;
    private static final Set<String> SUPPORTED_LOCATOR_TYPES = Set.of(
            "CSS",
            "TEXT",
            "ROLE",
            "PLACEHOLDER",
            "LABEL",
            "TEST_ID",
            "XPATH"
    );
    private static final String AI_SUPPLEMENT_SAVE_BLOCKED_REASON = "AI 补充候选需通过本地 Runner 验证后才能保存";

    private final AiProviderDomainService aiProviderDomainService;
    private final AiProviderClient aiProviderClient;
    private final ObjectMapper objectMapper;

    DefaultWebUiElementAiEnhancer(
            AiProviderDomainService aiProviderDomainService,
            AiProviderClient aiProviderClient
    ) {
        this.aiProviderDomainService = aiProviderDomainService;
        this.aiProviderClient = aiProviderClient;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public Result enhance(List<WebUiElementCollectCandidate> candidates, CollectWebUiElementsRequest request, String source) {
        if (candidates.isEmpty()) {
            return Result.fallback(candidates, "没有可增强的候选元素");
        }
        try {
            AiProviderDomainService.ResolvedProviderModelConfig resolved =
                    aiProviderDomainService.requireResolvedProviderModel(request.providerConnectionId(), request.modelName());
            String aiContent = aiProviderClient.requestStructuredContent(
                    profileWithElementLimit(resolved.profile()),
                    resolved.apiKey(),
                    buildPrompt(candidates, request, source)
            );
            return mergeAiResult(candidates, aiContent);
        } catch (BadRequestException exception) {
            return Result.fallback(candidates, readableReason(exception, "请选择 AI 采集模型"));
        } catch (RuntimeException exception) {
            return Result.fallback(candidates, readableReason(exception, "AI 增强调用失败"));
        }
    }

    private AiProviderRequestProfile profileWithElementLimit(AiProviderRequestProfile profile) {
        return new AiProviderRequestProfile(
                profile.protocolType(),
                profile.provider(),
                profile.model(),
                profile.baseUrl(),
                profile.temperature(),
                profile.topP(),
                MAX_AI_CANDIDATES,
                profile.requestTimeoutSeconds()
        );
    }

    private String buildPrompt(List<WebUiElementCollectCandidate> candidates, CollectWebUiElementsRequest request, String source) {
        List<PromptCandidate> promptCandidates = candidates.stream()
                .limit(MAX_AI_CANDIDATES)
                .map(item -> new PromptCandidate(
                        item.groupName(),
                        item.elementName(),
                        item.locatorType(),
                        item.locatorValue(),
                        item.confidence(),
                        item.reason(),
                        item.tagName(),
                        item.elementType(),
                        item.text(),
                        item.placeholder(),
                        item.ariaLabel(),
                        item.labelText(),
                        item.nearbyHeading()
                ))
                .toList();
        PromptPayload payload = new PromptPayload(
                blankToNull(request.pageName()),
                blankToNull(request.pageUrl()),
                blankToNull(request.scope()),
                source,
                promptCandidates
        );
        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("元素采集候选数据序列化失败");
        }

        return """
                你是企业自动化测试平台的 Web UI 元素库助手。
                当前阶段只允许你做候选元素的元数据增强：命名、分组、业务含义、保存建议、维护建议、置信度和原因说明。

                约束：
                1. 对已有候选：优先返回输入中已经存在的 locatorType + locatorValue，用于优化命名、分组和说明。
                2. elementName 使用简洁中文业务名，例如“用户名输入框”“查询按钮”“订单列表表格”。
                3. groupName 只能从以下标准区域中选择一个：顶部导航区、筛选表单区、操作按钮区、数据表格区、弹窗区、侧边栏区、未分类。不要自由创造“查询区”“搜索区”等近义分组。
                4. recommendedToSave 表示是否建议保存到元素库，纯布局容器、重复图标、无稳定语义的元素建议 false。
                5. maintenanceSuggestion 给出可维护建议，例如“建议研发补充 data-testid”。
                6. confidence 为 0-100 的整数，reason 用一句中文说明稳定性和语义依据。
                7. 如果你基于页面语义判断有明显漏采元素，可以额外返回少量 AI_SUPPLEMENT 候选，但必须满足：
                   - candidateSource 固定为 "AI_SUPPLEMENT"；
                   - locatorType 只能是 CSS、TEXT、ROLE、PLACEHOLDER、LABEL、TEST_ID、XPATH；
                   - locatorValue 不能为空；
                   - 不要返回和已有候选重复的 locator；
                   - 最多补充 10 条，优先补充按钮、输入框、表格、弹窗操作等可交互元素。
                8. AI_SUPPLEMENT 只是建议，平台会先标记为未验证，必须经过本地 Runner 真机验证后才能保存。
                9. 只返回 JSON，不要返回 Markdown。

                输出 JSON 格式：
                {
                  "message": "AI 已优化元素名称和分组",
                  "candidates": [
                    {
                      "locatorType": "CSS",
                      "locatorValue": "#username",
                      "groupName": "筛选表单区",
                      "elementName": "用户名输入框",
                      "confidence": 95,
                      "reason": "id 定位稳定，语义为登录用户名",
                      "businessMeaning": "登录账号",
                      "recommendedToSave": true,
                      "notRecommendedReason": null,
                      "maintenanceSuggestion": "建议保留 id 或补充 data-testid",
                      "stabilityNote": "id 定位稳定，保存前确认页面唯一性"
                    }
                  ]
                }

                输入：
                %s
                """.formatted(payloadJson);
    }

    private Result mergeAiResult(List<WebUiElementCollectCandidate> ruleCandidates, String aiContent) {
        AiCollectEnhanceResponse parsed;
        try {
            parsed = objectMapper.readValue(aiContent, AiCollectEnhanceResponse.class);
        } catch (JsonProcessingException exception) {
            return Result.fallback(ruleCandidates, "AI 返回内容不是有效 JSON");
        }
        if (parsed == null || parsed.candidates() == null || parsed.candidates().isEmpty()) {
            return Result.fallback(ruleCandidates, "AI 未返回可用候选元素");
        }

        Map<String, WebUiElementCollectCandidate> aiByLocator = new LinkedHashMap<>();
        List<WebUiElementCollectCandidate> aiSupplements = new ArrayList<>();
        Map<String, WebUiElementCollectCandidate> ruleByLocator = new LinkedHashMap<>();
        for (WebUiElementCollectCandidate ruleCandidate : ruleCandidates) {
            ruleByLocator.put(locatorKey(ruleCandidate.locatorType(), ruleCandidate.locatorValue()), ruleCandidate);
        }
        for (AiCollectEnhanceCandidate item : parsed.candidates()) {
            WebUiElementCollectCandidate aiCandidate = toAiCandidate(item);
            if (aiCandidate == null) {
                continue;
            }
            String key = locatorKey(aiCandidate.locatorType(), aiCandidate.locatorValue());
            if (key == null) {
                continue;
            }
            if (ruleByLocator.containsKey(key)) {
                aiByLocator.put(key, aiCandidate);
                continue;
            }
            if (aiSupplements.size() < MAX_AI_SUPPLEMENT_CANDIDATES && !containsLocator(aiSupplements, key)) {
                aiSupplements.add(toBlockedAiSupplement(aiCandidate));
            }
        }
        if (aiByLocator.isEmpty() && aiSupplements.isEmpty()) {
            return Result.fallback(ruleCandidates, "AI 返回候选元素缺少定位器");
        }

        List<WebUiElementCollectCandidate> merged = new ArrayList<>();
        boolean hasEnhanced = false;
        for (WebUiElementCollectCandidate ruleCandidate : ruleCandidates) {
            WebUiElementCollectCandidate aiCandidate = aiByLocator.get(locatorKey(ruleCandidate.locatorType(), ruleCandidate.locatorValue()));
            if (aiCandidate == null) {
                merged.add(ruleCandidate);
                continue;
            }
            merged.add(new WebUiElementCollectCandidate(
                    normalizeStandardGroupName(defaultText(aiCandidate.groupName(), ruleCandidate.groupName())),
                    defaultText(aiCandidate.elementName(), ruleCandidate.elementName()),
                    ruleCandidate.locatorType(),
                    ruleCandidate.locatorValue(),
                    ruleCandidate.framePath(),
                    ruleCandidate.shadowPath(),
                    ruleCandidate.locatorCandidates(),
                    aiCandidate.confidence() == null ? ruleCandidate.confidence() : aiCandidate.confidence(),
                    defaultText(aiCandidate.reason(), ruleCandidate.reason()),
                    ruleCandidate.tagName(),
                    ruleCandidate.elementType(),
                    ruleCandidate.text(),
                    ruleCandidate.placeholder(),
                    ruleCandidate.ariaLabel(),
                    ruleCandidate.labelText(),
                    ruleCandidate.nearbyHeading(),
                    defaultText(aiCandidate.businessMeaning(), ruleCandidate.businessMeaning()),
                    aiCandidate.recommendedToSave() == null ? ruleCandidate.recommendedToSave() : aiCandidate.recommendedToSave(),
                    defaultText(aiCandidate.notRecommendedReason(), ruleCandidate.notRecommendedReason()),
                    defaultText(aiCandidate.maintenanceSuggestion(), ruleCandidate.maintenanceSuggestion()),
                    defaultText(aiCandidate.stabilityNote(), ruleCandidate.stabilityNote()),
                    ruleCandidate.validationStatus(),
                    ruleCandidate.matchCount(),
                    ruleCandidate.validationMessage(),
                    ruleCandidate.screenshotBase64(),
                    defaultText(ruleCandidate.candidateSource(), "RULE"),
                    ruleCandidate.saveBlockedReason()
            ));
            hasEnhanced = true;
        }
        merged.addAll(aiSupplements);
        if (!hasEnhanced && aiSupplements.isEmpty()) {
            return Result.fallback(ruleCandidates, "AI 返回候选元素未匹配到规则定位器");
        }
        return Result.enhanced(merged, defaultText(parsed.message(), "AI 已优化元素名称和分组"));
    }

    private WebUiElementCollectCandidate toAiCandidate(AiCollectEnhanceCandidate item) {
        String locatorType = normalizeLocatorType(item.locatorType());
        String locatorValue = blankToNull(item.locatorValue());
        if (locatorType == null || locatorValue == null || !SUPPORTED_LOCATOR_TYPES.contains(locatorType)) {
            return null;
        }
        return new WebUiElementCollectCandidate(
                normalizeStandardGroupName(item.groupName()),
                defaultText(item.elementName(), null),
                locatorType,
                locatorValue,
                null,
                null,
                null,
                normalizeConfidence(item.confidence()),
                defaultText(item.reason(), null),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                defaultText(item.businessMeaning(), null),
                item.recommendedToSave(),
                defaultText(item.notRecommendedReason(), null),
                defaultText(item.maintenanceSuggestion(), null),
                defaultText(item.stabilityNote(), null),
                null,
                null,
                null,
                null,
                defaultText(item.candidateSource(), null),
                null
        );
    }

    private WebUiElementCollectCandidate toBlockedAiSupplement(WebUiElementCollectCandidate candidate) {
        return new WebUiElementCollectCandidate(
                normalizeStandardGroupName(candidate.groupName()),
                defaultText(candidate.elementName(), "AI 补充元素"),
                candidate.locatorType(),
                candidate.locatorValue(),
                candidate.framePath(),
                candidate.shadowPath(),
                candidate.locatorCandidates(),
                candidate.confidence(),
                defaultText(candidate.reason(), "AI 补充可能漏采的候选元素"),
                candidate.tagName(),
                candidate.elementType(),
                candidate.text(),
                candidate.placeholder(),
                candidate.ariaLabel(),
                candidate.labelText(),
                candidate.nearbyHeading(),
                candidate.businessMeaning(),
                false,
                AI_SUPPLEMENT_SAVE_BLOCKED_REASON,
                candidate.maintenanceSuggestion(),
                candidate.stabilityNote(),
                "AI_UNVERIFIED",
                null,
                "AI 补充候选尚未经过本地 Runner 真机验证",
                candidate.screenshotBase64(),
                "AI_SUPPLEMENT",
                AI_SUPPLEMENT_SAVE_BLOCKED_REASON
        );
    }

    private boolean containsLocator(List<WebUiElementCollectCandidate> candidates, String key) {
        for (WebUiElementCollectCandidate candidate : candidates) {
            if (key.equals(locatorKey(candidate.locatorType(), candidate.locatorValue()))) {
                return true;
            }
        }
        return false;
    }

    private String locatorKey(String locatorType, String locatorValue) {
        return normalizeLocatorType(locatorType) + "::" + locatorValue;
    }

    private String normalizeLocatorType(String locatorType) {
        String normalized = blankToNull(locatorType);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private Integer normalizeConfidence(Integer confidence) {
        if (confidence == null) {
            return null;
        }
        return Math.max(0, Math.min(100, confidence));
    }

    private String defaultText(String value, String fallback) {
        String normalized = blankToNull(value);
        return normalized == null ? fallback : normalized;
    }

    private String normalizeStandardGroupName(String value) {
        String normalized = blankToNull(value);
        if (normalized == null) {
            return "未分类";
        }
        if ("顶部导航区".equals(normalized)
                || "筛选表单区".equals(normalized)
                || "操作按钮区".equals(normalized)
                || "数据表格区".equals(normalized)
                || "弹窗区".equals(normalized)
                || "侧边栏区".equals(normalized)
                || "未分类".equals(normalized)) {
            return normalized;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.matches(".*(顶部|导航|菜单|页头|header|nav|menu).*")) {
            return "顶部导航区";
        }
        if (lower.matches(".*(筛选|查询|搜索|检索|过滤|表单|输入|选择|filter|search|form).*")) {
            return "筛选表单区";
        }
        if (lower.matches(".*(操作|按钮|工具栏|新增|添加|编辑|删除|提交|保存|确定|取消|关闭|批量|action|button|toolbar).*")) {
            return "操作按钮区";
        }
        if (lower.matches(".*(表格|列表|清单|数据|table|list|grid).*")) {
            return "数据表格区";
        }
        if (lower.matches(".*(弹窗|抽屉|浮层|对话框|modal|dialog|drawer|popup).*")) {
            return "弹窗区";
        }
        if (lower.matches(".*(侧边|侧栏|边栏|aside|sidebar).*")) {
            return "侧边栏区";
        }
        return "未分类";
    }

    private String readableReason(RuntimeException exception, String fallback) {
        String message = blankToNull(exception.getMessage());
        if (message == null) {
            return fallback;
        }
        return message.length() > 160 ? message.substring(0, 160) : message;
    }

    private record PromptPayload(
            String pageName,
            String pageUrl,
            String scope,
            String source,
            List<PromptCandidate> candidates
    ) {
    }

    private record PromptCandidate(
            String groupName,
            String elementName,
            String locatorType,
            String locatorValue,
            Integer confidence,
            String reason,
            String tagName,
            String elementType,
            String text,
            String placeholder,
            String ariaLabel,
            String labelText,
            String nearbyHeading
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AiCollectEnhanceResponse(
            String message,
            List<AiCollectEnhanceCandidate> candidates
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AiCollectEnhanceCandidate(
            String groupName,
            String elementName,
            String locatorType,
            String locatorValue,
            Integer confidence,
            String reason,
            String businessMeaning,
            Boolean recommendedToSave,
            String notRecommendedReason,
            String maintenanceSuggestion,
            String stabilityNote,
            String candidateSource
    ) {
    }
}
