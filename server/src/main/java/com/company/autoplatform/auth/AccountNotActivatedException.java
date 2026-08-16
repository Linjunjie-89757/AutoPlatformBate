package com.company.autoplatform.auth;

import com.company.autoplatform.common.BadRequestException;

public class AccountNotActivatedException extends BadRequestException {

    public AccountNotActivatedException() {
        super("账号尚未激活，请先通过邀请邮件设置密码");
    }
}
