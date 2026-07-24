package com.company.autoplatform.apiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_api_definition")
public class ApiDefinitionEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("definition_name")
    private String definitionName;

    @TableField("http_method")
    private String httpMethod;

    private String path;

    @TableField("directory_name")
    private String directoryName;

    @TableField("module_id")
    private Long moduleId;

    private String description;

    @TableField("tags_json")
    private String tagsJson;

    @TableField("request_json")
    private String requestJson;

    @TableField("assertions_json")
    private String assertionsJson;

    @TableField("extractors_json")
    private String extractorsJson;

    @TableField("preprocessors_json")
    private String preprocessorsJson;

    @TableField("postprocessors_json")
    private String postprocessorsJson;

    @TableField("last_run_result")
    private String lastRunResult;

    @TableField("last_run_at")
    private LocalDateTime lastRunAt;
}
