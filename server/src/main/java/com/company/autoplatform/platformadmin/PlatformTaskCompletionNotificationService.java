package com.company.autoplatform.platformadmin;

import com.company.autoplatform.execution.TaskEntity;
import com.company.autoplatform.user.UserEntity;
import com.company.autoplatform.user.UserMapper;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceMapper;
import org.springframework.stereotype.Service;

@Service
public class PlatformTaskCompletionNotificationService {

    private final UserMapper userMapper;
    private final WorkspaceMapper workspaceMapper;
    private final PlatformNotificationSettingsService notificationService;

    public PlatformTaskCompletionNotificationService(
            UserMapper userMapper,
            WorkspaceMapper workspaceMapper,
            PlatformNotificationSettingsService notificationService
    ) {
        this.userMapper = userMapper;
        this.workspaceMapper = workspaceMapper;
        this.notificationService = notificationService;
    }

    public void notifyCompleted(TaskEntity task) {
        if (task.getCreatorUserId() == null) return;
        UserEntity creator = userMapper.selectById(task.getCreatorUserId());
        if (creator == null || creator.getEmail() == null || creator.getEmail().isBlank()) return;
        WorkspaceEntity workspace = workspaceMapper.selectById(task.getWorkspaceId());
        String workspaceName = workspace == null ? "未知工作区" : workspace.getWorkspaceName();
        notificationService.sendOptional(
                "task-done",
                creator.getEmail(),
                "AutoTest 自动化任务已完成",
                "任务“%s”已结束。\n工作区：%s\n执行引擎：%s\n最终状态：%s"
                        .formatted(task.getTaskName(), workspaceName, task.getEngineType(), task.getTaskStatus())
        );
    }
}
