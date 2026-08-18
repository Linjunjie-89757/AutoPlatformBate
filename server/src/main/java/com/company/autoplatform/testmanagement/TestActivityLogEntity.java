package com.company.autoplatform.testmanagement;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_test_activity_log")
public class TestActivityLogEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("entity_type")
    private ActivityEntityType entityType;

    @TableField("entity_id")
    private Long entityId;

    @TableField("action_code")
    private String actionCode;

    @TableField("action_name")
    private String actionName;

    private String detail;

    @TableField("actor_id")
    private Long actorId;
}
