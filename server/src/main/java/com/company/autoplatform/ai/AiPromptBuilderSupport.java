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
            int maxCases,
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
        builder.append("- ").append(maxCases).append(" is a hard maximum cap. There is no mandatory minimum case count.\n");
        builder.append("- Quantity must come from full test-design decomposition, not from padding. Do not fabricate meaningless, duplicate, or hypothetical business scenarios just to reach a number.\n");
        builder.append("- Before writing cases, traverse all relevant coverage dimensions and split every distinguishable valid test point into an independent case: normal flows, exception flows, boundary values, equivalence classes, state transitions, multi-condition combinations/decision tables, error guessing, missing required data, multi-role differences, data dependencies, scheduled-task timing anomalies, third-party interaction exceptions, end-to-end links, non-functional risks, and test data initialization/cleanup.\n");
        builder.append("- Never return only one happy-path case when the requirement contains any branch, parameter, state, role, external dependency, scheduled behavior, UI/API flow, or abnormal condition.\n");
        builder.append("- For every explicit judgment rule, parameter validation, and state switch, generate positive matching, negative mismatch, boundary threshold, and missing-field variants when they are meaningful.\n");
        builder.append("- Cases with the same core trigger condition, execution steps, and expected result are duplicates. Minor changes to irrelevant field values cannot be treated as independent cases.\n");
        builder.append("- If the requirement is thin and only contains limited distinguishable test points, output all valid high-value cases truthfully even if the total is small. When the output format supports remainingCoverageGaps, explain that no more expandable scenarios exist.\n");
        builder.append("- If all distinguishable valid scenarios exceed ").append(maxCases).append(", output the highest-value ")
                .append(maxCases).append(" cases first, prioritizing high business risk, exception/boundary/state/combination coverage, third-party or scheduled-task failures, then normal and non-functional risks. When supported, report omitted branches in remainingCoverageGaps.\n");
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
                    9. There is no fixed minimum count. The only hard quantity rule is the maximum cap in Smart Generation Policy; however, all relevant coverage dimensions must be decomposed into independent cases, and a single happy-path-only answer is not acceptable when expandable test points exist.
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
        builder.append("[Candidate Cases To Review]\n");
        int index = 0;
        for (AiExistingCaseItem item : request.generatedCases()) {
            builder.append("[Index ").append(index++).append("] Title: ").append(nullSafe(item.title())).append('\n');
            builder.append("   Type: ").append(nullSafe(item.caseType()))
                    .append(", Priority: ").append(nullSafe(item.priority())).append('\n');
            builder.append("   Precondition: ").append(nullSafe(item.precondition())).append('\n');
            builder.append("   Steps: ").append(nullSafe(item.steps())).append('\n');
            builder.append("   Expected Result: ").append(nullSafe(item.expectedResult())).append('\n');
            builder.append("   Test Angle: ").append(nullSafe(item.testAngle())).append('\n');
            builder.append("   Generation Reason: ").append(nullSafe(item.generationReason())).append('\n');
            builder.append("   Requirement Evidence: ").append(nullSafe(item.requirementEvidence())).append("\n\n");
        }
        if (config.getReviewChecklist() != null && !config.getReviewChecklist().isBlank()) {
            builder.append("[Extra Review Checklist]\n").append(config.getReviewChecklist().trim()).append("\n\n");
        }
        if (streamMode) {
            builder.append("""
                    [Output Requirements]
                    1. Return NDJSON only. Do not return markdown, explanation, JSON array wrappers, or extra prose.
                    2. You have the full candidate case set above. First evaluate overall coverage, duplicates, gaps, and priorities internally, then output results line by line.
                    3. Output one complete JSON object per line. Flush each line immediately after the decision is ready. Do not wait until all lines are complete before emitting.
                    4. Output reviewed existing-case lines in ascending caseIndex order, then output any supplement lines.
                    5. Reviewed existing-case lines must contain:
                       - caseIndex: the zero-based Index shown above. This is an internal mapping key only.
                       - status: APPROVED, OPTIMIZED, CONFIRM_REQUIRED, or NOT_RECOMMENDED
                       - summary: one short actionable review summary. Do not mention internal labels such as "Index 0", "caseIndex", or "itemIndex"; refer to the case title or user-facing case number when needed.
                       - coverageComment: explain whether this case covers the intended requirement, risk, boundary, or scenario
                       - evidenceComment: judge whether requirementEvidence clearly maps to requirement text, business rule, image/prototype information, or a reasonable risk-based inference
                       - reviewComment: final quality judgment for this case
                       - optimizationReason: required when status is OPTIMIZED
                       - optimizedCase: required when status is OPTIMIZED, containing the full improved case fields
                       - coverageGap: optional gap this case relates to
                    6. Supplement lines must contain:
                       - status: SUPPLEMENTED
                       - summary: one short reason for adding the case
                       - supplementCase: the full new case fields
                       - supplementReason: what missing coverage this case fills
                       - coverageGap: the gap being covered
                    7. Use APPROVED when the case can be kept unchanged.
                    8. Use OPTIMIZED when the case is valuable but should be rewritten; include optimizedCase.
                    9. Do not use OPTIMIZED without optimizedCase. If you cannot provide a full rewritten case, use CONFIRM_REQUIRED.
                    10. Use CONFIRM_REQUIRED only when requirement ambiguity prevents a reliable automatic rewrite.
                    11. Use NOT_RECOMMENDED when the case is duplicated, low-value, unexecutable, or misaligned.
                    12. Add SUPPLEMENTED lines only for important missing coverage. Do not pad the count.
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
                           \"caseIndex\":0,
                           \"status\":\"APPROVED|OPTIMIZED|CONFIRM_REQUIRED|NOT_RECOMMENDED\",
                           \"summary\":\"short summary\",
                           \"coverageComment\":\"coverage judgment\",
                           \"evidenceComment\":\"evidence judgment\",
                           \"reviewComment\":\"quality judgment\",
                           \"optimizationReason\":\"why optimized, required for OPTIMIZED\",
                           \"coverageGap\":\"related gap if any\",
                           \"optimizedCase\":{ \"title\":\"...\", \"caseType\":\"FUNCTION|BOUNDARY|EXCEPTION|REGRESSION\", \"priority\":\"P0|P1|P2|P3\", \"precondition\":\"...\", \"steps\":\"...\", \"expectedResult\":\"...\", \"riskNotes\":\"...\", \"testAngle\":\"...\", \"generationReason\":\"...\", \"requirementEvidence\":\"...\" }
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
                    4. Review must directly optimize useful weak cases and supplement important missing cases.
                    5. Do not add low-value supplement cases. Total final cases should stay within the product limit.
                    """);
        }
        return builder.toString();
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
