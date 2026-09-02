package com.company.autoplatform.ai;

import com.company.autoplatform.casecenter.CaseDetailResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AiPromptBuilderSupport {

    String buildGeneratorPrompt(
            AiCaseConfigEntity config,
            GenerateAiCasesRequest request,
            WorkspaceEntity workspace,
            List<AiRequirementAssetEntity> assets,
            boolean streamMode
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append(config.getPromptTemplate()).append("\n\n");
        builder.append("[Workspace] ").append(workspace.getWorkspaceName()).append('\n');
        builder.append("[Requirement Title] ").append(request.requirementTitle().trim()).append('\n');
        builder.append("[Requirement Content]\n").append(request.requirementContent().trim()).append("\n\n");
        if (blankToNull(request.sceneFocus()) != null) {
            builder.append("[Focus] ").append(request.sceneFocus().trim()).append('\n');
        }
        if (request.existingCases() != null && !request.existingCases().isEmpty()) {
            builder.append("[Existing Candidate Cases]\n");
            int index = 1;
            for (AiExistingCaseItem item : request.existingCases()) {
                builder.append(index++).append(". ")
                        .append(item.title() == null ? "Untitled case" : item.title().trim())
                        .append(" / ").append(item.priority() == null ? "P1" : item.priority().trim())
                        .append(" / ").append(item.caseType() == null ? "FUNCTION" : item.caseType().trim())
                        .append('\n');
            }
            builder.append("Avoid duplicates with existing candidates. Prefer missing or uncovered scenarios.\n");
        }
        if (blankToNull(request.improvementNotes()) != null) {
            builder.append("[Additional Generation Notes]\n").append(request.improvementNotes().trim()).append("\n");
        }
        if (!assets.isEmpty()) {
            builder.append("[Image Assets] ")
                    .append(assets.size())
                    .append(" requirement images are attached. Use them together with the text requirement.\n");
            int imageIndex = 1;
            for (AiRequirementAssetEntity asset : assets) {
                builder.append("- Image ").append(imageIndex++).append(": ").append(asset.getFileName()).append('\n');
                if (blankToNull(asset.getExtractedText()) != null) {
                    builder.append("  OCR Summary: ").append(asset.getExtractedText().trim()).append('\n');
                }
            }
        }
        builder.append("[Smart Generation Policy]\n");
        builder.append("- Quantity must come from full test-design decomposition, not from padding. Do not fabricate meaningless, duplicate, or hypothetical business scenarios just to reach a number.\n");
        builder.append("- Before writing cases, traverse all relevant coverage dimensions and split every distinguishable valid test point into an independent case: normal flows, exception flows, boundary values, equivalence classes, state transitions, multi-condition combinations/decision tables, error guessing, missing required data, multi-role differences, data dependencies, scheduled-task timing anomalies, third-party interaction exceptions, end-to-end links, non-functional risks, and test data initialization/cleanup.\n");
        builder.append("- Never return only one happy-path case when the requirement contains any branch, parameter, state, role, external dependency, scheduled behavior, UI/API flow, or abnormal condition.\n");
        builder.append("- For every explicit judgment rule, parameter validation, and state switch, generate positive matching, negative mismatch, boundary threshold, and missing-field variants when they are meaningful.\n");
        builder.append("- Cases with the same core trigger condition, execution steps, and expected result are duplicates. Minor changes to irrelevant field values cannot be treated as independent cases.\n");
        builder.append("- If the requirement is thin and only contains limited distinguishable test points, output all valid high-value cases truthfully even if the total is small. When the output format supports remainingCoverageGaps, explain that no more expandable scenarios exist.\n");
        if (config.getReviewChecklist() != null && !config.getReviewChecklist().isBlank()) {
            builder.append("[Extra Checklist]\n").append(config.getReviewChecklist().trim()).append("\n\n");
        }
        if (streamMode) {
            builder.append("""
                    [Output Requirements]
                    1. Return NDJSON only. Do not return markdown, explanation, JSON array wrappers, or extra prose.
                    2. Output one complete JSON object per line. Each line represents one finished test case.
                    3. Every line must contain:
                       - title
                       - caseType
                       - priority
                       - precondition
                       - steps
                       - expectedResult
                       - riskNotes
                       - testAngle: one of 正常场景, 异常场景, 边界值, 等价类, 状态迁移, 组合/判定表, 错误推测, 端到端, 非功能, 数据依赖与清理
                       - generationReason: short reason explaining why this case is needed and what risk or coverage gap it targets
                       - requirementEvidence: requirement text, business rule, constraint, or image/prototype evidence that supports this case
                    4. caseType must be one of: FUNCTION, BOUNDARY, EXCEPTION, REGRESSION.
                    5. priority must be one of: P0, P1, P2, P3.
                    6. requirementEvidence must explain the source of the case:
                       - If based on requirement text, quote or summarize the related sentence, rule, or constraint.
                       - If based on an attached image/prototype, start with "图片素材显示：".
                       - If inferred from testing risk because the requirement is not explicit, start with "需求未明确，基于风险推断：".
                       - Do not fabricate exact requirement wording. If unsure, summarize instead of quoting.
                    7. Keep titles, steps, expected results, generationReason, and requirementEvidence concrete, executable, and verifiable.
                    8. Cover useful test points first. Do not pad with duplicate or low-value cases.
                    9. There is no fixed minimum count. Decompose all relevant coverage dimensions into independent cases, and do not return only a happy-path case when expandable test points exist.
                    10. When text and images both provide information, combine them and do not ignore key UI or flow details.
                    """);
        } else {
            builder.append("""
                    [Output Requirements]
                    1. Return JSON only. Do not return markdown, explanation, or extra prose.
                    2. The response must be:
                       {
                         "coverageSummary":"short summary of covered functions, risks, boundaries, and scenario types",
                         "remainingCoverageGaps":["gap that could not fit in the initial limit"],
                         "cases":[...]
                       }
                    3. Every case must contain:
                       - title
                       - caseType
                       - priority
                       - precondition
                       - steps
                       - expectedResult
                       - riskNotes
                       - testAngle: one of 正常场景, 异常场景, 边界值, 等价类, 状态迁移, 组合/判定表, 错误推测, 端到端, 非功能, 数据依赖与清理
                       - generationReason: short reason explaining why this case is needed and what risk or coverage gap it targets
                       - requirementEvidence: requirement text, business rule, constraint, or image/prototype evidence that supports this case
                    4. caseType must be one of: FUNCTION, BOUNDARY, EXCEPTION, REGRESSION.
                    5. priority must be one of: P0, P1, P2, P3.
                    6. requirementEvidence must explain the source of the case:
                       - If based on requirement text, quote or summarize the related sentence, rule, or constraint.
                       - If based on an attached image/prototype, start with "图片素材显示：".
                       - If inferred from testing risk because the requirement is not explicit, start with "需求未明确，基于风险推断：".
                       - Do not fabricate exact requirement wording. If unsure, summarize instead of quoting.
                    7. Keep titles, steps, expected results, generationReason, and requirementEvidence concrete, executable, and verifiable.
                    8. Cover useful test points first. Do not pad with duplicate or low-value cases.
                    9. There is no fixed minimum count. The only hard quantity rule is the maximum cap in Smart Generation Policy; however, all relevant coverage dimensions must be decomposed into independent cases, and a single happy-path-only answer is not acceptable when expandable test points exist.
                    10. When text and images both provide information, combine them and do not ignore key UI or flow details.
                    """);
        }
        return builder.toString();
    }

    String buildGeneratedCasesReviewPrompt(AiCaseConfigEntity config, ReviewAiGeneratedCasesRequest request, boolean streamMode) {
        return buildGeneratedCasesReviewPrompt(config, request, streamMode, true);
    }

    String buildGeneratedCasesReviewPrompt(
            AiCaseConfigEntity config,
            ReviewAiGeneratedCasesRequest request,
            boolean streamMode,
            boolean allowSupplement
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append(config.getPromptTemplate()).append("\n\n");
        builder.append("[Requirement Title] ").append(request.requirementTitle().trim()).append('\n');
        builder.append("[Requirement Content]\n").append(request.requirementContent().trim()).append("\n\n");
        if (blankToNull(request.sceneFocus()) != null) {
            builder.append("[Focus] ").append(request.sceneFocus().trim()).append('\n');
        }
        if (request.remainingCoverageGaps() != null && !request.remainingCoverageGaps().isEmpty()) {
            builder.append("[Remaining Coverage Gaps Reported By Generator]\n");
            for (String gap : request.remainingCoverageGaps()) {
                if (blankToNull(gap) != null) {
                    builder.append("- ").append(gap.trim()).append('\n');
                }
            }
            builder.append("Use these gaps as input, but independently verify coverage against the requirement.\n\n");
        }
        if (!allowSupplement) {
            builder.append("[Review Scope Rule]\n本次只评审上方全部已有用例，不要直接输出补充用例。所有缺口只在最后的 SUMMARY.unresolvedCoverageGaps 中汇总，后端将在评审完成后统一确认和补充。\n\n");
        }
        builder.append("[Candidate Cases To Review]\n");
        int index = 0;
        for (AiExistingCaseItem item : request.generatedCases()) {
            builder.append("[Candidate Index ").append(index++).append("] Title: ").append(nullSafe(item.title())).append('\n');
            builder.append("   Type: ").append(nullSafe(item.caseType()))
                    .append(", Priority: ").append(nullSafe(item.priority())).append('\n');
            builder.append("   Precondition: ").append(nullSafe(item.precondition())).append('\n');
            builder.append("   Steps: ").append(nullSafe(item.steps())).append('\n');
            builder.append("   Expected Result: ").append(nullSafe(item.expectedResult())).append("\n\n");
        }
        if (config.getReviewChecklist() != null && !config.getReviewChecklist().isBlank()) {
            builder.append("[Extra Review Checklist]\n").append(config.getReviewChecklist().trim()).append("\n\n");
        }
        if (streamMode) {
            builder.append("""
                    [Output Requirements]
                    1. Return NDJSON only. Do not return markdown, explanation, JSON array wrappers, or extra prose.
                    2. You have the full candidate case set above. First evaluate overall coverage, duplicates, gaps, and priorities internally, then output results line by line.
                    3. Output one complete JSON object per line and flush it immediately. Use the supplied Candidate Index as caseIndex and review existing cases in ascending caseIndex order.
                    4. Return exactly one decision line for every existing case. Never omit a case and never treat an omitted case as approved.
                    5. Keep APPROVED lines minimal. The exact schema is {"caseIndex":0,"status":"APPROVED"}. Do not repeat case content, reason, summary, score, confidence, comments, or suggestions.
                    6. For CHANGE_SUGGESTED, return {"caseIndex":0,"status":"CHANGE_SUGGESTED","reason":"specific actionable reason","suggestedCase":{...full case fields...}}.
                    7. For CONFIRM_REQUIRED, return {"caseIndex":0,"status":"CONFIRM_REQUIRED","reason":"risk or requirement ambiguity that needs human confirmation"}. Do not modify the case.
                    8. For NOT_RECOMMENDED, return {"caseIndex":0,"status":"NOT_RECOMMENDED","reasonCode":"DUPLICATE|LOW_VALUE|UNEXECUTABLE|MISALIGNED|OTHER","reason":"specific reason"}. Do not return suggestedCase.
                    9. After all decision lines, output exactly one final line: {"type":"SUMMARY","reviewedCount":<number of decision lines>,"unresolvedCoverageGaps":["confirmed global gap"],"result":"APPROVE|REJECT|SUGGEST"}.
                    10. reviewedCount must equal the total number of candidate cases. Only put globally missing coverage in unresolvedCoverageGaps; do not mistake a case that appears later in the supplied candidate set for a gap.
                    11. Do not output SUPPLEMENTED lines in this review. Coverage supplementation is a separate backend step after SUMMARY.
                    12. Never state that a suggestion has already been applied. Suggestions are read-only until human confirmation.
                    """);
        } else {
            builder.append("""
                    [Output Requirements]
                    1. Return JSON only. Do not return markdown, explanation, or extra prose.
                    2. The response must be:
                       {
                         \"result\":\"APPROVE|REJECT|SUGGEST\",
                         \"summary\":\"one-sentence summary\",
                         \"issues\":[\"issue 1\",\"issue 2\"],
                         \"suggestions\":[\"suggestion 1\",\"suggestion 2\"],
                         \"caseDecisions\":[{
                           \"candidateCaseId\":\"AIC_...\",
                           \"caseIndex\":0,
                           \"reviewStatus\":\"APPROVED|CHANGE_SUGGESTED|CONFIRM_REQUIRED|NOT_RECOMMENDED\",
                           \"suggestedAction\":\"KEEP|MODIFY|EXCLUDE|MERGE\",
                           \"summary\":\"short summary\",
                           \"reason\":\"specific review reason\",
                           \"score\":85,
                           \"confidence\":0.92,
                           \"coverageComment\":\"coverage judgment\",
                           \"evidenceComment\":\"evidence judgment\",
                           \"reviewComment\":\"quality judgment\",
                           \"coverageGap\":\"related gap if any\",
                           \"suggestedCase\":{ \"title\":\"...\", \"caseType\":\"FUNCTION|BOUNDARY|EXCEPTION|REGRESSION\", \"priority\":\"P0|P1|P2|P3\", \"precondition\":\"...\", \"steps\":\"...\", \"expectedResult\":\"...\", \"riskNotes\":\"...\", \"testAngle\":\"...\", \"generationReason\":\"...\", \"requirementEvidence\":\"...\" },
                           \"mergeTargetCaseIds\":[],
                           \"sourceVersion\":1,
                           \"sourceContentHash\":\"sha256...\"
                         }],
                         \"supplementCases\":[{
                           \"title\":\"...\",
                           \"caseType\":\"FUNCTION|BOUNDARY|EXCEPTION|REGRESSION\",
                           \"priority\":\"P0|P1|P2|P3\",
                           \"precondition\":\"...\",
                           \"steps\":\"...\",
                           \"expectedResult\":\"...\",
                           \"riskNotes\":\"...\",
                           \"testAngle\":\"...\",
                           \"generationReason\":\"why this supplement is needed\",
                           \"requirementEvidence\":\"requirement text, image/prototype evidence, or risk inference\",
                           \"supplementReason\":\"what missing coverage this case fills\",
                           \"coverageGap\":\"the gap being covered\"
                         }],
                         \"unresolvedCoverageGaps\":[\"gap still not covered because of ambiguity or final limit\"]
                       }
                    3. Use issues to point out missing coverage, duplicates, ambiguity, or non-executable content.
                    4. Review must provide suggestions for useful weak cases and supplement important missing cases. It must never apply a suggestion or claim that candidate content has been changed.
                    5. Do not add low-value supplement cases. Total final cases should stay within the product limit.
                    """);
        }
        return builder.toString();
    }

    String buildGenerationSelfCheckPrompt(
            AiCaseConfigEntity config,
            GenerateAiCasesRequest request,
            List<GeneratedAiCaseItem> generatedCases
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append(config.getPromptTemplate()).append("\n\n");
        builder.append("[Generation Self-Check]\n");
        builder.append("检查已经生成的测试用例是否遗漏需求中的重要测试覆盖。只检查，不修改已有用例。\n");
        builder.append("[Requirement Title] ").append(request.requirementTitle().trim()).append('\n');
        builder.append("[Requirement Content]\n").append(request.requirementContent().trim()).append("\n\n");
        builder.append("[Generated Cases]\n");
        appendCaseSummary(builder, generatedCases);
        builder.append("""
                [Output Requirements]
                Return JSON only:
                {
                  "is_complete": true,
                  "missing_coverage_items": ["具体遗漏点"],
                  "duplicate_case_indexes": [0],
                  "supplement_guidance": "仅描述需要补充的场景和原因"
                }
                Rules:
                - is_complete means no obvious high-value gap was found, not proof of complete coverage.
                - Only report meaningful gaps that can become executable test cases.
                - Do not output test case objects in this response.
                - Do not treat minor wording differences as missing coverage or duplicates.
                """);
        return builder.toString();
    }

    String buildGeneratedCasesCoverageSupplementPrompt(
            AiCaseConfigEntity config,
            ReviewAiGeneratedCasesRequest request,
            List<String> coverageGaps
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append(config.getPromptTemplate()).append("\n\n");
        builder.append("[Coverage Review Supplement]\n");
        builder.append("以下是各评审批次汇总出的疑似缺口。先结合全部已有用例确认是否真的缺失，只针对确认缺失的覆盖点补充重要且可执行的新测试用例。不要修改已有用例，不要重复已有用例。\n");
        builder.append("[Requirement Title] ").append(request.requirementTitle().trim()).append('\n');
        builder.append("[Requirement Content]\n").append(request.requirementContent().trim()).append("\n\n");
        builder.append("[Global Coverage Gaps]\n");
        for (String gap : coverageGaps == null ? List.<String>of() : coverageGaps) {
            if (blankToNull(gap) != null) {
                builder.append("- ").append(gap.trim()).append('\n');
            }
        }
        builder.append("\n[Existing Cases To Avoid]\n");
        appendCaseSummary(builder, request.generatedCases().stream().map(this::toGeneratedCaseSummary).toList());
        builder.append("""
                [Output Requirements]
                Return JSON only:
                {
                  "supplementCases":[{
                    "title":"...",
                    "caseType":"FUNCTION|BOUNDARY|EXCEPTION|REGRESSION",
                    "priority":"P0|P1|P2|P3",
                    "precondition":"...",
                    "steps":"...",
                    "expectedResult":"...",
                    "riskNotes":"...",
                    "testAngle":"...",
                    "generationReason":"why this case is needed",
                    "requirementEvidence":"requirement text, image/prototype evidence, or risk inference",
                    "supplementReason":"what missing coverage this case fills",
                    "coverageGap":"the gap being covered"
                  }],
                  "unresolvedCoverageGaps":["gap that remains unresolved"]
                }
                Rules:
                - First verify every listed gap against all existing cases. If an existing case already covers it, do not supplement it.
                - Only output the necessary cases that directly address confirmed global gaps. Do not target or pad to any case count.
                - Do not output caseDecisions or explanatory prose.
                """);
        return builder.toString();
    }

    private GeneratedAiCaseItem toGeneratedCaseSummary(AiExistingCaseItem item) {
        return new GeneratedAiCaseItem(
                item.title(), item.caseType(), item.priority(), item.precondition(), item.steps(), item.expectedResult(),
                null, item.testAngle(), item.generationReason(), item.requirementEvidence(), null, null, null, null,
                null, null, null, null, null, null, null, null
        );
    }

    String buildGenerationSupplementPrompt(
            AiCaseConfigEntity config,
            GenerateAiCasesRequest request,
            List<GeneratedAiCaseItem> generatedCases,
            List<String> missingGaps,
            String supplementGuidance
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append(config.getPromptTemplate()).append("\n\n");
        builder.append("[Generation Targeted Supplement]\n");
        builder.append("只针对明确缺口补充新的高价值测试用例，不要重复或修改已有用例。\n");
        builder.append("[Requirement Title] ").append(request.requirementTitle().trim()).append('\n');
        builder.append("[Requirement Content]\n").append(request.requirementContent().trim()).append("\n\n");
        builder.append("[Missing Coverage Items]\n");
        for (String gap : missingGaps == null ? List.<String>of() : missingGaps) {
            if (blankToNull(gap) != null) {
                builder.append("- ").append(gap.trim()).append('\n');
            }
        }
        if (blankToNull(supplementGuidance) != null) {
            builder.append("[Supplement Guidance]\n").append(supplementGuidance.trim()).append("\n");
        }
        builder.append("[Existing Cases To Avoid]\n");
        appendCaseSummary(builder, generatedCases);
        builder.append("""
                [Output Requirements]
                Return JSON only:
                {
                  "cases": [{
                    "title":"...",
                    "caseType":"FUNCTION|BOUNDARY|EXCEPTION|REGRESSION",
                    "priority":"P0|P1|P2|P3",
                    "precondition":"...",
                    "steps":"...",
                    "expectedResult":"...",
                    "riskNotes":"...",
                    "testAngle":"...",
                    "generationReason":"...",
                    "requirementEvidence":"...",
                    "supplementReason":"补充原因",
                    "coverageGap":"对应缺口"
                  }]
                }
                Rules:
                - Output only cases needed for the listed gaps. Do not target or pad to any case count.
                - Do not output explanations outside JSON.
                """);
        return builder.toString();
    }

    private void appendCaseSummary(StringBuilder builder, List<GeneratedAiCaseItem> cases) {
        int index = 0;
        for (GeneratedAiCaseItem item : cases == null ? List.<GeneratedAiCaseItem>of() : cases) {
            builder.append(index++).append(". ")
                    .append(nullSafe(item.title())).append(" / ")
                    .append(nullSafe(item.caseType())).append(" / ")
                    .append(nullSafe(item.priority())).append('\n')
                    .append("   Precondition: ").append(nullSafe(item.precondition())).append('\n')
                    .append("   Steps: ").append(nullSafe(item.steps())).append('\n')
                    .append("   Expected: ").append(nullSafe(item.expectedResult())).append('\n');
        }
    }

    String buildSavedCaseReviewPrompt(AiCaseConfigEntity config, CaseDetailResponse detail) {
        StringBuilder builder = new StringBuilder();
        builder.append(config.getPromptTemplate()).append("\n\n");
        builder.append("[Case Title] ").append(detail.title()).append('\n');
        builder.append("[Priority] ").append(detail.priority()).append('\n');
        builder.append("[Precondition] ").append(nullSafe(detail.precondition())).append('\n');
        builder.append("[Steps] ").append(nullSafe(detail.steps())).append('\n');
        builder.append("[Expected Result] ").append(nullSafe(detail.expectedResult())).append("\n\n");
        if (config.getReviewChecklist() != null && !config.getReviewChecklist().isBlank()) {
            builder.append("[Extra Review Checklist]\n").append(config.getReviewChecklist().trim()).append("\n\n");
        }
        builder.append("""
                [Output Requirements]
                1. Return JSON only. Do not return markdown, explanation, or extra prose.
                2. The response must be:
                   {
                     \"result\":\"APPROVE|REJECT|SUGGEST\",
                     \"summary\":\"one-sentence summary\",
                     \"issues\":[\"issue 1\",\"issue 2\"],
                     \"suggestions\":[\"suggestion 1\",\"suggestion 2\"]
                   }
                3. Focus on whether the case is clear, complete, executable, and verifiable.
                """);
        return builder.toString();
    }

    private String blankToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String nullSafe(String value) {
        return blankToNull(value) == null ? "-" : value.trim();
    }
}
