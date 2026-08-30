CREATE TABLE IF NOT EXISTS tb_ai_case_candidate (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    display_index INT NOT NULL,
    origin VARCHAR(32) NOT NULL,
    original_case_json CLOB NOT NULL,
    suggested_case_json CLOB,
    current_case_json CLOB NOT NULL,
    review_status VARCHAR(32),
    suggested_action VARCHAR(32),
    review_score INT,
    review_confidence DOUBLE,
    review_reason VARCHAR(2000),
    merge_target_candidate_ids_json CLOB,
    human_decision VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    content_version INT NOT NULL DEFAULT 1,
    content_hash VARCHAR(64) NOT NULL,
    suggestion_source_version INT,
    suggestion_source_hash VARCHAR(64),
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ai_case_candidate_id UNIQUE (candidate_id),
    CONSTRAINT uk_ai_case_candidate_task_index UNIQUE (task_id, display_index)
);

CREATE INDEX IF NOT EXISTS idx_ai_case_candidate_task
    ON tb_ai_case_candidate (task_id, display_index);

CREATE INDEX IF NOT EXISTS idx_ai_case_candidate_review
    ON tb_ai_case_candidate (task_id, review_status, human_decision);

CREATE TABLE IF NOT EXISTS tb_ai_case_candidate_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    candidate_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    from_version INT,
    to_version INT,
    before_case_json CLOB,
    after_case_json CLOB,
    metadata_json CLOB,
    operator_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_case_candidate_audit_candidate
    ON tb_ai_case_candidate_audit (candidate_id, created_at);

ALTER TABLE tb_ai_case_adoption ADD COLUMN IF NOT EXISTS candidate_id VARCHAR(64);
ALTER TABLE tb_ai_case_adoption ADD COLUMN IF NOT EXISTS adopted_content_version INT;
ALTER TABLE tb_ai_case_adoption ADD COLUMN IF NOT EXISTS adopted_content_source VARCHAR(32);
ALTER TABLE tb_ai_case_adoption ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_case_adoption_candidate
    ON tb_ai_case_adoption (candidate_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_case_adoption_idempotency
    ON tb_ai_case_adoption (idempotency_key);
