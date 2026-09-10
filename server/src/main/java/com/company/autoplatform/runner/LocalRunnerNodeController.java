package com.company.autoplatform.runner;

import com.company.autoplatform.auth.CurrentUserContext;
import com.company.autoplatform.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

import static com.company.autoplatform.runner.LocalRunnerModels.RunnerNodeSummaryResponse;
import static com.company.autoplatform.runner.LocalRunnerModels.RunnerRegistrationCodeResponse;

@RestController
@RequestMapping("/api/local-runner/nodes")
public class LocalRunnerNodeController {

    private final LocalRunnerService localRunnerService;

    public LocalRunnerNodeController(LocalRunnerService localRunnerService) {
        this.localRunnerService = localRunnerService;
    }

    @PostMapping("/registration-codes")
    public ApiResponse<RunnerRegistrationCodeResponse> createRegistrationCode() {
        CurrentUserContext.require();
        return ApiResponse.ok(localRunnerService.createRegistrationCode(), "注册码生成成功");
    }

    @GetMapping
    public ApiResponse<List<RunnerNodeSummaryResponse>> listNodes(
            @RequestParam(value = "taskType", required = false) String taskType,
            @RequestParam(value = "resourceCost", required = false) Integer resourceCost
    ) {
        CurrentUserContext.require();
        return ApiResponse.ok(localRunnerService.listRunnerNodes(Duration.ofMinutes(2), taskType, resourceCost));
    }
}
