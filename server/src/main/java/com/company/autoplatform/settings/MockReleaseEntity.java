package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_mock_release")
public class MockReleaseEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("app_id")
    private Long appId;

    @TableField("version_no")
    private Integer versionNo;

    @TableField("release_name")
    private String releaseName;

    @TableField("snapshot_json")
    private String snapshotJson;

    @TableField("is_active")
    private Integer active;
}
