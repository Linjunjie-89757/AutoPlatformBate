package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_workspace_role_permission")
public class WorkspaceRolePermissionEntity extends BaseEntity {

    @TableField("role_id")
    private Long roleId;

    @TableField("permission_code")
    private String permissionCode;
}
