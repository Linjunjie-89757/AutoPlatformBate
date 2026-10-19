package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceMapper;
import com.company.autoplatform.workspace.WorkspaceScope;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class MockControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WorkspaceMapper workspaceMapper;

    @Autowired
    private MockApplicationMapper applicationMapper;

    @Autowired
    private MockCallLogMapper callLogMapper;

    @Test
    void unmatchedCallLogCountOnlyIncludesRecentUnmatchedLogsForApplication() throws Exception {
        WorkspaceEntity workspace = workspaceMapper.selectOne(Wrappers.<WorkspaceEntity>lambdaQuery()
                .eq(WorkspaceEntity::getWorkspaceCode, WORKSPACE_CODE));
        org.junit.jupiter.api.Assertions.assertNotNull(workspace);

        String suffix = UUID.randomUUID().toString().replace("-", "");
        MockApplicationEntity target = createApplication(workspace.getId(), "target-" + suffix);
        MockApplicationEntity other = createApplication(workspace.getId(), "other-" + suffix);
        LocalDateTime now = LocalDateTime.now();

        insertCallLog(workspace.getId(), target.getId(), 0, now.minusMinutes(5));
        insertCallLog(workspace.getId(), target.getId(), 1, now.minusMinutes(5));
        insertCallLog(workspace.getId(), target.getId(), 0, now.minusHours(25));
        insertCallLog(workspace.getId(), other.getId(), 0, now.minusMinutes(5));

        mockMvc.perform(get("/api/settings/mock/call-logs/unmatched-count")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("appId", target.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", is(1)));
    }

    private MockApplicationEntity createApplication(Long workspaceId, String appCode) {
        MockApplicationEntity application = new MockApplicationEntity();
        application.setWorkspaceId(workspaceId);
        application.setAppName(appCode);
        application.setAppCode(appCode);
        application.setStatus(1);
        application.setCreatedAt(LocalDateTime.now());
        application.setUpdatedAt(LocalDateTime.now());
        applicationMapper.insert(application);
        return application;
    }

    private void insertCallLog(Long workspaceId, Long appId, int matched, LocalDateTime createdAt) {
        MockCallLogEntity log = new MockCallLogEntity();
        log.setWorkspaceId(workspaceId);
        log.setAppId(appId);
        log.setHttpMethod("GET");
        log.setRequestPath("/health");
        log.setResponseStatus(200);
        log.setMatched(matched);
        log.setStatus(matched == 1 ? "MATCHED" : "NOT_MATCHED");
        log.setCreatedAt(createdAt);
        log.setUpdatedAt(createdAt);
        callLogMapper.insert(log);
    }
}
