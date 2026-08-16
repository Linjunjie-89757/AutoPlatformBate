package com.company.autoplatform.execution;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_exec_task")
public class TaskEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("creator_user_id")
    private Long creatorUserId;

    @TableField("task_name")
    private String taskName;

    @TableField("engine_type")
    private String engineType;

    @TableField("task_status")
    private String taskStatus;

    private String summary;
}
