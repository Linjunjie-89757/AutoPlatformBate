package com.company.autoplatform.user;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class UserRoleSupport {

    private final UserMapper userMapper;

    public UserRoleSupport(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public String normalizeStoredRole(String roleCode) {
        String normalized = roleCode == null ? PlatformRole.MEMBER : roleCode.trim().toUpperCase();
        return switch (normalized) {
            case PlatformRole.SUPER_ADMIN -> PlatformRole.SUPER_ADMIN;
            case "ADMIN", PlatformRole.PLATFORM_ADMIN -> PlatformRole.PLATFORM_ADMIN;
            case PlatformRole.MEMBER, PlatformRole.VIEWER -> PlatformRole.MEMBER;
            default -> throw new BadRequestException("无效的成员角色");
        };
    }

    public boolean isPlatformAdmin(Long userId) {
        UserEntity user = findActiveUser(userId);
        return user != null && PlatformRole.isAdminRole(user.getRoleCode());
    }

    public boolean isCurrentPlatformAdmin() {
        return PlatformRole.isAdminRole(CurrentUserContext.require().platformRole());
    }

    public boolean isSuperAdmin(Long userId) {
        UserEntity user = findActiveUser(userId);
        return user != null && PlatformRole.isSuperAdmin(user.getRoleCode());
    }

    public boolean isCurrentSuperAdmin() {
        return PlatformRole.isSuperAdmin(CurrentUserContext.require().platformRole());
    }

    public void requirePlatformAdmin() {
        if (!isCurrentPlatformAdmin()) {
            throw new AccessDeniedException("只有管理员可执行该操作");
        }
    }

    public boolean isStoredAdminRole(String roleCode) {
        return PlatformRole.isAdminRole(roleCode);
    }

    public boolean isSuperAdminRole(String roleCode) {
        return PlatformRole.isSuperAdmin(roleCode);
    }

    public void requireAssignableRole(String storedRole) {
        if (PlatformRole.SUPER_ADMIN.equals(storedRole)) {
            throw new BadRequestException("超级管理员仅允许系统初始化创建");
        }
        if (PlatformRole.PLATFORM_ADMIN.equals(storedRole) && !isCurrentSuperAdmin()) {
            throw new AccessDeniedException("只有超级管理员可以创建或调整管理员");
        }
    }

    public void ensureVisibleTarget(UserEntity targetUser) {
        if (isSuperAdminRole(targetUser.getRoleCode())) {
            throw new BadRequestException("超级管理员不在成员管理列表中维护");
        }
    }

    public void ensureAdminMutationAllowed(UserEntity targetUser) {
        if (PlatformRole.PLATFORM_ADMIN.equalsIgnoreCase(targetUser.getRoleCode()) && !isCurrentSuperAdmin()) {
            throw new AccessDeniedException("只有超级管理员可以操作管理员");
        }
    }

    private UserEntity findActiveUser(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.getStatus() != 1) {
            return null;
        }
        return user;
    }
}
