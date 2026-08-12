package com.company.autoplatform.ai;

import com.company.autoplatform.IntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class AiGenerationTaskStorageIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private AiGenerationTaskMapper aiGenerationTaskMapper;

    @Test
    void storesTwoHundredGeneratedCasesBeyondTextColumnLimit() {
        StringBuilder generatedCasesJson = new StringBuilder("[");
        for (int index = 0; index < 200; index++) {
            if (index > 0) {
                generatedCasesJson.append(',');
            }
            generatedCasesJson.append("{\"title\":\"case-")
                    .append(index)
                    .append("\",\"steps\":\"")
                    .append("execute a representative business step ".repeat(12))
                    .append("\",\"expectedResult\":\"the expected business result is returned\"}");
        }
        generatedCasesJson.append(']');
        assertThat(generatedCasesJson.length()).isGreaterThan(65_535);

        LocalDateTime now = LocalDateTime.now();
        AiGenerationTaskEntity entity = new AiGenerationTaskEntity();
        entity.setTaskId("TASK_STORAGE_" + System.nanoTime());
        entity.setWorkspaceId(1L);
        entity.setRequirementTitle("large generation result storage");
        entity.setRequirementContent("verify storage for two hundred generated cases");
        entity.setOutputMode("STREAM");
        entity.setStatus("COMPLETED");
        entity.setCurrentStep(4);
        entity.setGeneratedCasesJson(generatedCasesJson.toString());
        entity.setGeneratedCount(200);
        entity.setSavedCaseCount(0);
        entity.setCancelRequested(0);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        aiGenerationTaskMapper.insert(entity);

        AiGenerationTaskEntity stored = aiGenerationTaskMapper.selectById(entity.getId());
        assertThat(stored.getGeneratedCount()).isEqualTo(200);
        assertThat(stored.getGeneratedCasesJson()).isEqualTo(generatedCasesJson.toString());
    }
}
