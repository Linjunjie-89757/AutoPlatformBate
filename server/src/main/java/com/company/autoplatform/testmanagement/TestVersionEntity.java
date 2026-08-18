package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.Version;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_version")
public class TestVersionEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("version_no")
    private String versionNo;

    private String name;

    @TableField("version_type")
    private VersionType versionType;

    private VersionStatus status;

    @TableField("owner_id")
    private Long ownerId;

    @TableField("start_date")
    private LocalDate startDate;

    @TableField("test_date")
    private LocalDate testDate;

    @TableField("release_date")
    private LocalDate releaseDate;

    private String goal;

    @Version
    @TableField("lock_version")
    private Integer lockVersion;

    @TableField("archived_at")
    private LocalDateTime archivedAt;

    @TableField("created_by")
    private Long createdBy;

    @TableField("updated_by")
    private Long updatedBy;
}
