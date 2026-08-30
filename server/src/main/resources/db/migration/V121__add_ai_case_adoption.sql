CREATE TABLE IF NOT EXISTS tb_ai_case_adoption (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    case_index INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(1000),
    directory_id BIGINT,
    created_case_id BIGINT,
    attempt_count INT NOT NULL DEFAULT 0,
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_ai_case_adoption_task_case UNIQUE (task_id, case_index)
);

CREATE INDEX IF NOT EXISTS idx_ai_case_adoption_task ON tb_ai_case_adoption (task_id, status);
