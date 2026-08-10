package com.company.autoplatform.workspace;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_workspace_member_role")
public class WorkspaceMemberRoleEntity extends BaseEntity {

    @TableField("member_id")
    private Long memberId;

    @TableField("role_id")
    private Long roleId;
}
