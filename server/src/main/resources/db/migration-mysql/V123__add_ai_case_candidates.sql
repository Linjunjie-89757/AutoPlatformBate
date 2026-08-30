CREATE TABLE IF NOT EXISTS tb_ai_case_candidate (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    display_index INT NOT NULL,
    origin VARCHAR(32) NOT NULL,
    original_case_json LONGTEXT NOT NULL,
    suggested_case_json LONGTEXT NULL,
    current_case_json LONGTEXT NOT NULL,
    review_status VARCHAR(32) NULL,
    suggested_action VARCHAR(32) NULL,
    review_score INT NULL,
    review_confidence DOUBLE NULL,
    review_reason VARCHAR(2000) NULL,
    merge_target_candidate_ids_json LONGTEXT NULL,
    human_decision VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    content_version INT NOT NULL DEFAULT 1,
    content_hash VARCHAR(64) NOT NULL,
    suggestion_source_version INT NULL,
    suggestion_source_hash VARCHAR(64) NULL,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ai_case_candidate_id (candidate_id),
    UNIQUE KEY uk_ai_case_candidate_task_index (task_id, display_index),
    KEY idx_ai_case_candidate_task (task_id, display_index),
    KEY idx_ai_case_candidate_review (task_id, review_status, human_decision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_ai_case_candidate_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    from_version INT NULL,
    to_version INT NULL,
    before_case_json LONGTEXT NULL,
    after_case_json LONGTEXT NULL,
    metadata_json LONGTEXT NULL,
    operator_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ai_case_candidate_audit_candidate (candidate_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE tb_ai_case_adoption
    ADD COLUMN candidate_id VARCHAR(64) NULL,
    ADD COLUMN adopted_content_version INT NULL,
    ADD COLUMN adopted_content_source VARCHAR(32) NULL,
    ADD COLUMN idempotency_key VARCHAR(128) NULL,
    ADD UNIQUE KEY uk_ai_case_adoption_candidate (candidate_id),
    ADD UNIQUE KEY uk_ai_case_adoption_idempotency (idempotency_key);
