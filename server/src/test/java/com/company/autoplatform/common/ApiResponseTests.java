package com.company.autoplatform.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTests {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void successfulResponseKeepsLegacyJsonShape() throws Exception {
        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(ApiResponse.ok("value")));

        assertThat(json.path("success").asBoolean()).isTrue();
        assertThat(json.path("data").asText()).isEqualTo("value");
        assertThat(json.path("message").asText()).isEqualTo("OK");
        assertThat(json.has("code")).isFalse();
        assertThat(json.has("details")).isFalse();
    }

    @Test
    void businessFailureIncludesStableCodeAndDetails() throws Exception {
        ApiResponse<Void> response = ApiResponse.fail(
                "测试计划未达到完成条件",
                "TM_QUALITY_GATE_FAILED",
                Map.of("failedChecks", 2)
        );
        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertThat(json.path("success").asBoolean()).isFalse();
        assertThat(json.path("code").asText()).isEqualTo("TM_QUALITY_GATE_FAILED");
        assertThat(json.path("details").path("failedChecks").asInt()).isEqualTo(2);
    }
}
