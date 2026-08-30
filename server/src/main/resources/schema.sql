CREATE TABLE IF NOT EXISTS tb_sys_workspace (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_code VARCHAR(64) NOT NULL UNIQUE,
    workspace_name VARCHAR(128) NOT NULL,
    description VARCHAR(255),
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    password VARCHAR(255),
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tb_sys_user ADD COLUMN IF NOT EXISTS password VARCHAR(255);

CREATE TABLE IF NOT EXISTS tb_sys_workspace_member (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role_code VARCHAR(32) NOT NULL,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_case_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    case_no VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    case_type VARCHAR(64) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    owner_id BIGINT,
    precondition TEXT,
    steps TEXT,
    expected_result TEXT,
    execution_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_exec_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    engine_type VARCHAR(32) NOT NULL,
    task_status VARCHAR(32) NOT NULL,
    summary VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_exec_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    result VARCHAR(32) NOT NULL,
    failure_summary VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_bug_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    bug_no VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(16) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    assignee_id BIGINT,
    reporter_id BIGINT NOT NULL,
    related_case_id BIGINT,
    related_report_id BIGINT,
    related_task_id BIGINT,
    bug_type VARCHAR(64),
    environment_name VARCHAR(128),
    tags_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_bug_flow_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bug_id BIGINT NOT NULL,
    from_status VARCHAR(32) NOT NULL,
    to_status VARCHAR(32) NOT NULL,
    operator_id BIGINT NOT NULL,
    action_comment VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_bug_comment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bug_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    commenter_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_bug_attachment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bug_id BIGINT NOT NULL,
    workspace_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    stored_path VARCHAR(512) NOT NULL,
    content_type VARCHAR(128),
    file_size BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_case_execution_attachment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    workspace_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    stored_path VARCHAR(512) NOT NULL,
    content_type VARCHAR(128),
    file_size BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_env_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    env_type VARCHAR(32) NOT NULL,
    env_name VARCHAR(128) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    config_json TEXT,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_param_set (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    param_type VARCHAR(32) NOT NULL,
    param_name VARCHAR(128) NOT NULL,
    content_json TEXT,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tb_ai_case_candidate (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL UNIQUE,
    task_id VARCHAR(64) NOT NULL,
    display_index INT NOT NULL,
    origin VARCHAR(32) NOT NULL,
    original_case_json TEXT NOT NULL,
    suggested_case_json TEXT,
    current_case_json TEXT NOT NULL,
    review_status VARCHAR(32),
    suggested_action VARCHAR(32),
    review_score INT,
    review_confidence DOUBLE,
    review_reason VARCHAR(2000),
    merge_target_candidate_ids_json TEXT,
    human_decision VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    content_version INT NOT NULL DEFAULT 1,
    content_hash VARCHAR(64) NOT NULL,
    suggestion_source_version INT,
    suggestion_source_hash VARCHAR(64),
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, display_index)
);

CREATE TABLE IF NOT EXISTS tb_ai_case_candidate_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    from_version INT,
    to_version INT,
    before_case_json TEXT,
    after_case_json TEXT,
    metadata_json TEXT,
    operator_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
