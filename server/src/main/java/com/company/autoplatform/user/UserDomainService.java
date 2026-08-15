package com.company.autoplatform.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.auth.AuthenticatedSessionService;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.workspace.WorkspaceEntity;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class UserDomainService {

    private final UserMapper userMapper;
    private final UserCredentialSupport userCredentialSupport;
    private final UserRoleSupport userRoleSupport;
    private final UserWorkspaceGrantSupport userWorkspaceGrantSupport;
    private final AuthenticatedSessionService authenticatedSessionService;

    public UserDomainService(
            UserMapper userMapper,
            UserCredentialSupport userCredentialSupport,
            UserRoleSupport userRoleSupport,
            UserWorkspaceGrantSupport userWorkspaceGrantSupport,
            AuthenticatedSessionService authenticatedSessionService
    ) {
        this.userMapper = userMapper;
        this.userCredentialSupport = userCredentialSupport;
        this.userRoleSupport = userRoleSupport;
        this.userWorkspaceGrantSupport = userWorkspaceGrantSupport;
        this.authenticatedSessionService = authenticatedSessionService;
    }

    public List<UserItem> listUsers() {
        userRoleSupport.requirePlatformAdmin();
        List<UserEntity> users = userMapper.selectList(new LambdaQueryWrapper<UserEntity>().orderByAsc(UserEntity::getId));
        Map<Long, List<WorkspaceEntity>> workspaceMap = userWorkspaceGrantSupport.buildUserWorkspaceMap();
        return users.stream()
                .filter(user -> !userRoleSupport.isSuperAdminRole(user.getRoleCode()))
                .map(user -> toItem(user, workspaceMap.getOrDefault(user.getId(), List.of())))
                .toList();
    }

    public List<UserEntity> listWorkspaceAssignableUsers() {
        return userMapper.selectList(new LambdaQueryWrapper<UserEntity>()
                        .eq(UserEntity::getStatus, 1)
                        .orderByAsc(UserEntity::getId))
                .stream()
                .filter(user -> !userRoleSupport.isStoredAdminRole(user.getRoleCode()))
                .toList();
    }

    public UserItem createUser(CreateUserRequest request) {
        userRoleSupport.requirePlatformAdmin();
        String username = request.username().trim();
        String email = request.email().trim();
        if (userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getUsername, username)
                .last("limit 1")) != null) {
            throw new BadRequestException("账号已存在");
        }
        validateEmailAvailable(email, null);

        String storedRole = userRoleSupport.normalizeStoredRole(request.roleCode());
        userRoleSupport.requireAssignableRole(storedRole);

        UserEntity entity = new UserEntity();
        entity.setUsername(username);
        entity.setEmail(email);
        entity.setDisplayName(request.displayName().trim());
        entity.setRoleCode(storedRole);
        entity.setPassword(userCredentialSupport.encodeDefaultPassword());
        entity.setStatus(1);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        userMapper.insert(entity);

        userWorkspaceGrantSupport.replaceWorkspaceCodes(entity, request.workspaceCodes());
        return toItem(entity, userWorkspaceGrantSupport.findUserWorkspaces(entity.getId()));
    }

    public UserItem updateUser(Long userId, UpdateUserRequest request) {
        userRoleSupport.requirePlatformAdmin();
        UserEntity entity = requireAnyUser(userId);
        userRoleSupport.ensureVisibleTarget(entity);

        String email = request.email().trim();
        validateEmailAvailable(email, userId);

        String storedRole = userRoleSupport.normalizeStoredRole(request.roleCode());
        userRoleSupport.requireAssignableRole(storedRole);
        userRoleSupport.ensureAdminMutationAllowed(entity);

        Integer previousStatus = entity.getStatus();
        entity.setEmail(email);
        entity.setDisplayName(request.displayName().trim());
        entity.setRoleCode(storedRole);
        entity.setStatus(request.status());
        entity.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(entity);
        if (previousStatus != null && previousStatus == 1 && request.status() == 0) {
            authenticatedSessionService.expireUserSessions(entity.getId());
        }

        if (request.workspaceCodes() != null) {
            userWorkspaceGrantSupport.replaceWorkspaceCodes(entity, request.workspaceCodes());
        }
        return toItem(entity, userWorkspaceGrantSupport.findUserWorkspaces(entity.getId()));
    }

    public UserEntity requireUser(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.getStatus() != 1) {
            throw new BadRequestException("用户不存在");
        }
        return user;
    }

    public UserEntity findActiveUser(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.getStatus() != 1) {
            return null;
        }
        return user;
    }

    public UserEntity requireAnyUser(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new BadRequestException("用户不存在");
        }
        return user;
    }

    public UserEntity findAnyUserByAccount(String account) {
        if (account == null || account.isBlank()) {
            return null;
        }
        String normalized = account.trim();
        return userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .and(wrapper -> wrapper.eq(UserEntity::getUsername, normalized)
                        .or()
                        .eq(UserEntity::getEmail, normalized))
                .last("limit 1"));
    }

    UserItem toItem(UserEntity user, List<WorkspaceEntity> workspaces) {
        return new UserItem(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                userRoleSupport.isSuperAdminRole(user.getRoleCode()) ? "SUPER_ADMIN" : (PlatformRole.PLATFORM_ADMIN.equalsIgnoreCase(user.getRoleCode()) ? "ADMIN" : "MEMBER"),
                user.getStatus(),
                workspaces.stream().map(WorkspaceEntity::getWorkspaceCode).toList(),
                workspaces.stream().map(WorkspaceEntity::getWorkspaceName).toList()
        );
    }

    private void validateEmailAvailable(String email, Long excludeUserId) {
        UserEntity existing = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getEmail, email)
                .last("limit 1"));
        if (existing != null && (excludeUserId == null || !existing.getId().equals(excludeUserId))) {
            throw new BadRequestException("邮箱已存在");
        }
    }

}
