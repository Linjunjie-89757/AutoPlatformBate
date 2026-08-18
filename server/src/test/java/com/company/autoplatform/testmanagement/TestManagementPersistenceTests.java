package com.company.autoplatform.testmanagement;

import com.company.autoplatform.IntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TestManagementPersistenceTests extends IntegrationTestSupport {

    @Autowired
    private TestVersionMapper versionMapper;

    @Autowired
    private TestActivityLogService activityLogService;

    @Autowired
    private TestActivityLogMapper activityLogMapper;

    @Test
    void persistsEnumFieldsAndRecordsCurrentActorInActivityTimeline() {
        LocalDateTime now = LocalDateTime.now();
        TestVersionEntity version = new TestVersionEntity();
        version.setWorkspaceId(90001L);
        version.setVersionNo("VER-FOUNDATION-001");
        version.setName("foundation-test-version");
        version.setVersionType(VersionType.ITERATION);
        version.setStatus(VersionStatus.PLANNING);
        version.setOwnerId(11L);
        version.setStartDate(LocalDate.now());
        version.setLockVersion(0);
        version.setCreatedBy(11L);
        version.setUpdatedBy(11L);
        version.setCreatedAt(now);
        version.setUpdatedAt(now);

        versionMapper.insert(version);
        TestVersionEntity persisted = versionMapper.selectById(version.getId());
        assertThat(persisted.getVersionType()).isEqualTo(VersionType.ITERATION);
        assertThat(persisted.getStatus()).isEqualTo(VersionStatus.PLANNING);

        TestActivityLogEntity activity = activityLogService.record(
                90001L,
                ActivityEntityType.VERSION,
                version.getId(),
                "VERSION_CREATED",
                "创建版本",
                Map.of("versionNo", version.getVersionNo())
        );
        TestActivityLogEntity persistedActivity = activityLogMapper.selectById(activity.getId());
        assertThat(persistedActivity.getActorId()).isEqualTo(11L);
        assertThat(persistedActivity.getEntityType()).isEqualTo(ActivityEntityType.VERSION);
        assertThat(persistedActivity.getDetail()).contains("VER-FOUNDATION-001");
    }
}
