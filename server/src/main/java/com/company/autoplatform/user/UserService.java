package com.company.autoplatform.user;

import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class UserService {

    public static final String DEFAULT_PASSWORD = "zhyt@2025";

    private final UserMapper userMapper;
    private final UserDomainService userDomainService;
    private final UserCredentialSupport userCredentialSupport;
    private final UserRoleSupport userRoleSupport;
    private final UserWorkspaceGrantSupport userWorkspaceGrantSupport;

    public UserService(
            UserMapper userMapper,
            UserDomainService userDomainService,
            UserCredentialSupport userCredentialSupport,
            UserRoleSupport userRoleSupport,
            UserWorkspaceGrantSupport userWorkspaceGrantSupport
    ) {
        this.userMapper = userMapper;
        this.userDomainService = userDomainService;
        this.userCredentialSupport = userCredentialSupport;
        this.userRoleSupport = userRoleSupport;
        this.userWorkspaceGrantSupport = userWorkspaceGrantSupport;
    }

    public List<UserItem> listUsers() {
        return userDomainService.listUsers();
    }

    public List<UserEntity> listWorkspaceAssignableUsers() {
        return userDomainService.listWorkspaceAssignableUsers();
    }

    public UserItem createUser(CreateUserRequest request) {
        return userDomainService.createUser(request);
    }

    public BatchCreateUserResponse batchCreateUsers(BatchCreateUserRequest request) {
        requirePlatformAdmin();
        List<BatchCreateUserItem> results = new ArrayList<>();
        int successCount = 0;
        List<CreateUserRequest> users = request.users() == null ? List.of() : request.users();
        for (int i = 0; i < users.size(); i++) {
            CreateUserRequest item = users.get(i);
            try {
                UserItem created = createUser(item);
                successCount++;
                results.add(new BatchCreateUserItem(
                        i + 1,
                        safeTrim(item.username()),
                        safeTrim(item.email()),
                        safeTrim(item.displayName()),
                        true,
                        "创建成功",
                        created
                ));
            } catch (RuntimeException ex) {
                results.add(new BatchCreateUserItem(
                        i + 1,
                        item == null ? "" : safeTrim(item.username()),
                        item == null ? "" : safeTrim(item.email()),
                        item == null ? "" : safeTrim(item.displayName()),
                        false,
                        ex.getMessage(),
                        null
                ));
            }
        }
        return new BatchCreateUserResponse(users.size(), successCount, users.size() - successCount, results);
    }

    public UserItem updateUser(Long userId, UpdateUserRequest request) {
        return userDomainService.updateUser(userId, request);
    }

    public UserItem replaceWorkspaceRoles(Long userId, ReplaceUserWorkspaceRolesRequest request) {
        requirePlatformAdmin();
        UserEntity entity = requireAnyUser(userId);
        userRoleSupport.ensureVisibleTarget(entity);
        userRoleSupport.ensureAdminMutationAllowed(entity);
        userWorkspaceGrantSupport.replaceWorkspaceCodes(entity, request.workspaceCodes());
        return userDomainService.toItem(entity, userWorkspaceGrantSupport.findUserWorkspaces(userId));
    }

    public ResetPasswordResponse resetPassword(Long userId) {
        requirePlatformAdmin();
        UserEntity entity = requireAnyUser(userId);
        userRoleSupport.ensureVisibleTarget(entity);
        userRoleSupport.ensureAdminMutationAllowed(entity);
        entity.setPassword(userCredentialSupport.encodeDefaultPassword());
        entity.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(entity);
        return new ResetPasswordResponse(entity.getId(), entity.getUsername(), userCredentialSupport.defaultPassword());
    }

    public void removeAdminFromWorkspace(Long userId, String workspaceCode) {
        requirePlatformAdmin();
        if (!isCurrentSuperAdmin()) {
            throw new BadRequestException("只有超级管理员可以移除管理员");
        }
        UserEntity entity = requireAnyUser(userId);
        userRoleSupport.ensureVisibleTarget(entity);
        if (!PlatformRole.PLATFORM_ADMIN.equalsIgnoreCase(entity.getRoleCode())) {
            throw new BadRequestException("当前成员不是管理员");
        }

        entity.setRoleCode(PlatformRole.MEMBER);
        entity.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(entity);
        userWorkspaceGrantSupport.replaceWorkspaceCodes(entity, userWorkspaceGrantSupport.remainingWorkspaceCodesExcept(workspaceCode));
    }

    public UserEntity requireUser(Long userId) {
        return userDomainService.requireUser(userId);
    }

    public UserEntity findActiveUser(Long userId) {
        return userDomainService.findActiveUser(userId);
    }

    public UserEntity requireAnyUser(Long userId) {
        return userDomainService.requireAnyUser(userId);
    }

    public UserEntity findAnyUserByAccount(String account) {
        return userDomainService.findAnyUserByAccount(account);
    }

    public boolean isPlatformAdmin(Long userId) {
        return userRoleSupport.isPlatformAdmin(userId);
    }

    public boolean isCurrentPlatformAdmin() {
        return userRoleSupport.isCurrentPlatformAdmin();
    }

    public boolean isSuperAdmin(Long userId) {
        return userRoleSupport.isSuperAdmin(userId);
    }

    public boolean isCurrentSuperAdmin() {
        return userRoleSupport.isCurrentSuperAdmin();
    }

    public List<UserEntity> listPlatformAdminUsers() {
        return userWorkspaceGrantSupport.listPlatformAdminUsers();
    }

    public void requirePlatformAdmin() {
        userRoleSupport.requirePlatformAdmin();
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

}
