package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_workspace_role")
public class WorkspaceRoleEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("role_code")
    private String roleCode;

    @TableField("role_name")
    private String roleName;

    private String description;

    private Integer status;
}
