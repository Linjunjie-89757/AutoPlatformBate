CREATE TABLE IF NOT EXISTS tb_ai_case_adoption (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    case_index INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_reason VARCHAR(1000) NULL,
    directory_id BIGINT NULL,
    created_case_id BIGINT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ai_case_adoption_task_case (task_id, case_index),
    KEY idx_ai_case_adoption_task (task_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
