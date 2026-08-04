package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_mock_call_log")
public class MockCallLogEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("app_id")
    private Long appId;

    @TableField("endpoint_id")
    private Long endpointId;

    @TableField("scenario_id")
    private Long scenarioId;

    @TableField("business_scenario_id")
    private Long businessScenarioId;

    @TableField("release_id")
    private Long releaseId;

    @TableField("release_version")
    private Integer releaseVersion;

    @TableField("http_method")
    private String httpMethod;

    @TableField("request_path")
    private String requestPath;

    @TableField("request_headers_json")
    private String requestHeadersJson;

    @TableField("request_body")
    private String requestBody;

    @TableField("response_status")
    private Integer responseStatus;

    @TableField("response_headers_json")
    private String responseHeadersJson;

    @TableField("response_body")
    private String responseBody;

    private Integer matched;

    private String status;
}
