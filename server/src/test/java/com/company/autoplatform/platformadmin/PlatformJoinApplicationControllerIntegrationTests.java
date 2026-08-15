package com.company.autoplatform.platformadmin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.auth.CurrentUserPrincipal;
import com.company.autoplatform.auth.PlatformRole;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceJoinApplicationEntity;
import com.company.autoplatform.workspace.WorkspaceJoinApplicationMapper;
import com.company.autoplatform.workspace.WorkspaceMapper;
import com.company.autoplatform.workspace.WorkspaceMemberEntity;
import com.company.autoplatform.workspace.WorkspaceMemberMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class PlatformJoinApplicationControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private WorkspaceMapper workspaceMapper;

    @Autowired
    private WorkspaceJoinApplicationMapper applicationMapper;

    @Autowired
    private WorkspaceMemberMapper workspaceMemberMapper;

    @Test
    void superAdminCanListRejectAndApproveJoinApplications() throws Exception {
        UserEntity applicant = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getRoleCode, PlatformRole.MEMBER)
                .last("limit 1"));
        WorkspaceEntity workspace = workspaceMapper.selectOne(new LambdaQueryWrapper<WorkspaceEntity>()
                .orderByAsc(WorkspaceEntity::getId)
                .last("limit 1"));
        LocalDateTime now = LocalDateTime.now();
        WorkspaceJoinApplicationEntity application = new WorkspaceJoinApplicationEntity();
        application.setWorkspaceId(workspace.getId());
        application.setApplicantUserId(applicant.getId());
        application.setStatus("PENDING");
        application.setCreatedAt(now);
        application.setUpdatedAt(now);
        applicationMapper.insert(application);

        var superAdminAuthentication = authenticationForSuperAdmin();
        mockMvc.perform(get("/api/platform-admin/join-applications")
                        .with(authentication(superAdminAuthentication))
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].id", hasItem(application.getId().intValue())))
                .andExpect(jsonPath("$.data[?(@.id == %s)].applicantEmail".formatted(application.getId()))
                        .value(hasItem(applicant.getEmail())));

        mockMvc.perform(post("/api/platform-admin/join-applications/{applicationId}/reject", application.getId())
                        .with(authentication(superAdminAuthentication))
                        .contentType("application/json")
                        .content("{\"reason\":\"不在项目授权名单内\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.rejectReason").value("不在项目授权名单内"));

        mockMvc.perform(get("/api/platform-admin/join-applications")
                        .with(authentication(superAdminAuthentication))
                        .param("status", "HANDLED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].id", hasItem(application.getId().intValue())));

        WorkspaceJoinApplicationEntity approval = new WorkspaceJoinApplicationEntity();
        approval.setWorkspaceId(workspace.getId());
        approval.setApplicantUserId(applicant.getId());
        approval.setStatus("PENDING");
        approval.setCreatedAt(now);
        approval.setUpdatedAt(now);
        applicationMapper.insert(approval);

        mockMvc.perform(post("/api/platform-admin/join-applications/{applicationId}/approve", approval.getId())
                        .with(authentication(superAdminAuthentication)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        assertTrue(workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMemberEntity>()
                .eq(WorkspaceMemberEntity::getWorkspaceId, workspace.getId())
                .eq(WorkspaceMemberEntity::getUserId, applicant.getId())
                .eq(WorkspaceMemberEntity::getStatus, 1)) > 0);
    }

    @Test
    void platformAdminCannotAccessPlatformJoinApprovals() throws Exception {
        mockMvc.perform(get("/api/platform-admin/join-applications"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    private UsernamePasswordAuthenticationToken authenticationForSuperAdmin() {
        UserEntity superAdmin = userMapper.selectOne(new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getRoleCode, PlatformRole.SUPER_ADMIN)
                .last("limit 1"));
        CurrentUserPrincipal principal = new CurrentUserPrincipal(
                superAdmin.getId(),
                superAdmin.getUsername(),
                superAdmin.getDisplayName(),
                superAdmin.getPassword(),
                PlatformRole.SUPER_ADMIN,
                superAdmin.getStatus()
        );
        return new UsernamePasswordAuthenticationToken(
                principal,
                principal.getPassword(),
                principal.getAuthorities()
        );
    }
}
