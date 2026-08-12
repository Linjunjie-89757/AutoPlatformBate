package com.company.autoplatform.ai;

import com.company.autoplatform.common.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiCaseConfigDomainServiceTests {

    private final AiCaseConfigDomainService service = new AiCaseConfigDomainService(
            null,
            null,
            null,
            null,
            60
    );

    @Test
    void maxCasesDefaultsToFifty() {
        assertEquals(50, service.normalizeRoleMaxCases(null));
    }

    @Test
    void maxCasesAllowsTwoHundred() {
        assertEquals(200, service.normalizeRoleMaxCases(200));
    }

    @Test
    void maxCasesRejectsValuesAboveTwoHundred() {
        assertThrows(BadRequestException.class, () -> service.normalizeRoleMaxCases(201));
    }

    @Test
    void unknownImageCapabilityAllowsAnActualModelRequest() {
        AiModelCapabilities detected = AiModelCapabilities.infer(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "deepseek-v4-pro",
                true
        );

        assertNull(detected.imageInput().supported());
        assertTrue(service.supportsImageInputForGeneration(resolved(detected, detected)));
    }

    @Test
    void manualImageCapabilityOverrideTakesPrecedence() {
        AiModelCapabilities detected = AiModelCapabilities.infer(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "deepseek-v4-pro",
                true
        );
        AiModelCapabilities enabled = detected.applyOverride(new AiCapabilityOverride(null, null, null, true, null, null));
        AiModelCapabilities disabled = detected.applyOverride(new AiCapabilityOverride(null, null, null, false, null, null));

        assertTrue(service.supportsImageInputForGeneration(resolved(detected, enabled)));
        assertFalse(service.supportsImageInputForGeneration(resolved(detected, disabled)));
    }

    @Test
    void staleNegativeNameInferenceDoesNotBlockAnActualModelRequest() {
        AiModelCapabilities staleDetected = AiModelCapabilities.infer(
                AiProviderClient.PROTOCOL_OPENAI_COMPATIBLE_CHAT,
                "deepseek-v4-pro",
                true
        ).withImageInput(AiModelCapabilities.value(
                false,
                AiModelCapabilities.SOURCE_INFERRED,
                "未从模型名称中识别出视觉能力"
        ));

        assertTrue(service.supportsImageInputForGeneration(resolved(staleDetected, staleDetected)));
    }

    private AiCaseConfigDomainService.ResolvedRoleConfig resolved(
            AiModelCapabilities detected,
            AiModelCapabilities effective
    ) {
        return new AiCaseConfigDomainService.ResolvedRoleConfig(null, null, null, null, detected, effective);
    }
}
