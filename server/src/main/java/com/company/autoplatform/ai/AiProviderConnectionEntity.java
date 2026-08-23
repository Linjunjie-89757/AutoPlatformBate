package com.company.autoplatform.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.company.autoplatform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("tb_ai_provider_connection")
public class AiProviderConnectionEntity extends BaseEntity {

    @TableField("workspace_id")
    private Long workspaceId;

    @TableField("owner_user_id")
    private Long ownerUserId;

    @TableField("connection_name")
    private String connectionName;

    @TableField("provider_type")
    private String providerType;

    @TableField("protocol_type")
    private String protocolType;

    @TableField("base_url")
    private String baseUrl;

    @TableField("request_timeout_seconds")
    private Integer requestTimeoutSeconds;

    @TableField("selected_model_name")
    private String selectedModelName;

    @TableField("api_key_cipher_text")
    private String apiKeyCipherText;

    private Integer status;

    @TableField("last_verified_at")
    private LocalDateTime lastVerifiedAt;

    @TableField("last_fetch_models_at")
    private LocalDateTime lastFetchModelsAt;

    @TableField("last_test_at")
    private LocalDateTime lastTestAt;

    @TableField("last_test_status")
    private String lastTestStatus;

    @TableField("last_test_message")
    private String lastTestMessage;
}
