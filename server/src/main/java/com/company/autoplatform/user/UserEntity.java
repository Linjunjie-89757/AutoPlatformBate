package com.company.autoplatform.user;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_sys_user")
public class UserEntity extends BaseEntity {

    private String username;
    private String email;

    @TableField("display_name")
    private String displayName;

    @TableField("role_code")
    private String roleCode;

    @TableField("creation_source")
    private String creationSource;

    private String password;

    private Integer status;
}
