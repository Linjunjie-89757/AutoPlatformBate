package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_workspace")
public class WorkspaceEntity extends BaseEntity {

    @TableField("workspace_code")
    private String workspaceCode;

    @TableField("workspace_name")
    private String workspaceName;

    @TableField("workspace_type")
    private String workspaceType;

    @TableField("owner_user_id")
    private Long ownerUserId;

    private String industry;

    @TableField("initialization_mode")
    private String initializationMode;

    private String description;

    private Integer status;
}
