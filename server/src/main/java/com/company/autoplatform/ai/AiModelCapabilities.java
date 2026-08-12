package com.company.autoplatform.ai;

import java.util.Locale;

public record AiModelCapabilities(
        AiCapabilityValue textChat,
        AiCapabilityValue streamOutput,
        AiCapabilityValue structuredOutput,
        AiCapabilityValue imageInput,
        AiCapabilityValue longContext,
        AiCapabilityValue stableAvailable
) {
    public static final String SOURCE_DECLARED = "DECLARED";
    public static final String SOURCE_INFERRED = "INFERRED";
    public static final String SOURCE_PROBED = "PROBED";
    public static final String SOURCE_MANUAL = "MANUAL";
    public static final String SOURCE_UNKNOWN = "UNKNOWN";

    public static AiModelCapabilities unknown() {
        AiCapabilityValue unknown = unknownValue();
        return new AiModelCapabilities(unknown, unknown, unknown, unknown, unknown, unknown);
    }

    public static AiCapabilityValue value(Boolean supported, String source, String detail) {
        return new AiCapabilityValue(supported, source, detail);
    }

    public static AiCapabilityValue unknownValue() {
        return value(null, SOURCE_UNKNOWN, null);
    }

    public static AiModelCapabilities infer(String protocolType, String modelName, boolean stableAvailable) {
        String normalizedModel = modelName == null ? "" : modelName.trim().toLowerCase(Locale.ROOT);
        boolean likelyImage = normalizedModel.contains("gpt-4o")
                || normalizedModel.contains("vision")
                || normalizedModel.contains("vl")
                || normalizedModel.contains("qwen-vl")
                || normalizedModel.contains("gemini")
                || normalizedModel.contains("claude-3")
                || normalizedModel.contains("pixtral");
        AiCapabilityValue imageInput = likelyImage
                ? value(true, SOURCE_INFERRED, "根据模型名称推断可能支持图片输入")
                : value(null, SOURCE_UNKNOWN, "模型名称未提供足够信息，需以能力探测或实际请求为准");
        boolean likelyLongContext = normalizedModel.contains("128k")
                || normalizedModel.contains("200k")
                || normalizedModel.contains("32k")
                || normalizedModel.contains("long")
                || normalizedModel.contains("kimi");
        boolean likelyStream = protocolType != null && !protocolType.isBlank();
        boolean likelyStructured = protocolType != null && !protocolType.isBlank();
        return new AiModelCapabilities(
                value(true, SOURCE_INFERRED, "同协议模型默认支持文本对话"),
                value(likelyStream, SOURCE_INFERRED, "基于协议能力做初步推断"),
                value(likelyStructured, SOURCE_INFERRED, "基于协议能力做初步推断"),
                imageInput,
                value(likelyLongContext, SOURCE_INFERRED, likelyLongContext ? "根据模型名称推断可能具备长上下文" : "未识别出明显长上下文标识"),
                value(stableAvailable, stableAvailable ? SOURCE_PROBED : SOURCE_UNKNOWN, stableAvailable ? "最近一次连接或探测成功" : null)
        );
    }

    public AiModelCapabilities applyOverride(AiCapabilityOverride override) {
        if (override == null || !override.hasAnyValue()) {
            return this;
        }
        return new AiModelCapabilities(
                apply(textChat, override.textChat()),
                apply(streamOutput, override.streamOutput()),
                apply(structuredOutput, override.structuredOutput()),
                apply(imageInput, override.imageInput()),
                apply(longContext, override.longContext()),
                apply(stableAvailable, override.stableAvailable())
        );
    }

    public AiModelCapabilities withTextChat(AiCapabilityValue value) {
        return new AiModelCapabilities(value, streamOutput, structuredOutput, imageInput, longContext, stableAvailable);
    }

    public AiModelCapabilities withStreamOutput(AiCapabilityValue value) {
        return new AiModelCapabilities(textChat, value, structuredOutput, imageInput, longContext, stableAvailable);
    }

    public AiModelCapabilities withStructuredOutput(AiCapabilityValue value) {
        return new AiModelCapabilities(textChat, streamOutput, value, imageInput, longContext, stableAvailable);
    }

    public AiModelCapabilities withImageInput(AiCapabilityValue value) {
        return new AiModelCapabilities(textChat, streamOutput, structuredOutput, value, longContext, stableAvailable);
    }

    public AiModelCapabilities withLongContext(AiCapabilityValue value) {
        return new AiModelCapabilities(textChat, streamOutput, structuredOutput, imageInput, value, stableAvailable);
    }

    public AiModelCapabilities withStableAvailable(AiCapabilityValue value) {
        return new AiModelCapabilities(textChat, streamOutput, structuredOutput, imageInput, longContext, value);
    }

    public boolean supportsImageInput() {
        return Boolean.TRUE.equals(imageInput.supported());
    }

    private AiCapabilityValue apply(AiCapabilityValue base, Boolean override) {
        if (override == null) {
            return base;
        }
        return value(override, SOURCE_MANUAL, "管理员手工修正");
    }
}
