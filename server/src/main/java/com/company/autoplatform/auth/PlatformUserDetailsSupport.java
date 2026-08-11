package com.company.autoplatform.auth;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

@Component
public class PlatformUserDetailsSupport {

    private final UserMapper userMapper;

    public PlatformUserDetailsSupport(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public UserDetails loadUserByUsername(String username) {
        UserEntity user = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .and(wrapper -> wrapper.eq(UserEntity::getUsername, username)
                        .or()
                        .eq(UserEntity::getEmail, username))
                .last("limit 1"));
        if (user == null) {
            throw new UsernameNotFoundException("用户不存在");
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            throw new BadRequestException("当前账号未设置密码");
        }
        return new CurrentUserPrincipal(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getPassword(),
                user.getRoleCode(),
                user.getStatus()
        );
    }
}
