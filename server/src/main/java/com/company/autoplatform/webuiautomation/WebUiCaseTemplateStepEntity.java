package com.company.autoplatform.webuiautomation;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_web_ui_case_template_step")
public class WebUiCaseTemplateStepEntity extends BaseEntity {

    @TableField("template_id")
    private Long templateId;

    @TableField("step_name")
    private String stepName;

    @TableField("step_type")
    private String stepType;

    @TableField("element_id")
    private Long elementId;

    @TableField("locator_type")
    private String locatorType;

    @TableField("locator_value")
    private String locatorValue;

    @TableField("locator_context_json")
    private String locatorContextJson;

    @TableField("input_value")
    private String inputValue;

    @TableField("upload_artifact_json")
    private String uploadArtifactJson;

    @TableField("timeout_ms")
    private Integer timeoutMs;

    @TableField("continue_on_failure")
    private Boolean continueOnFailure;

    @TableField("screenshot_policy")
    private String screenshotPolicy;

    private Boolean enabled;

    @TableField("sort_order")
    private Integer sortOrder;
}
