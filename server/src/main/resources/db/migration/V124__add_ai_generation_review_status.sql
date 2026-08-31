ALTER TABLE tb_ai_generation_task ADD COLUMN generation_status VARCHAR(32) DEFAULT 'PENDING';
ALTER TABLE tb_ai_generation_task ADD COLUMN review_status VARCHAR(32) DEFAULT 'NOT_STARTED';
ALTER TABLE tb_ai_generation_task ADD COLUMN failed_stage VARCHAR(32);
ALTER TABLE tb_ai_generation_task ADD COLUMN error_code VARCHAR(64);

UPDATE tb_ai_generation_task
SET generation_status = CASE
    WHEN status = 'GENERATING' THEN 'RUNNING'
    WHEN status = 'REVIEWING' THEN 'SUCCEEDED'
    WHEN status = 'COMPLETED' THEN 'SUCCEEDED'
    WHEN status = 'FAILED' THEN 'FAILED'
    WHEN status = 'CANCELED' THEN 'CANCELED'
    ELSE 'PENDING'
END
WHERE generation_status IS NULL;

UPDATE tb_ai_generation_task
SET review_status = CASE
    WHEN status = 'REVIEWING' THEN 'RUNNING'
    WHEN status = 'COMPLETED' THEN 'SUCCEEDED'
    WHEN status = 'FAILED' AND current_step >= 3 THEN 'FAILED'
    WHEN status = 'CANCELED' AND current_step >= 3 THEN 'CANCELED'
    ELSE 'NOT_STARTED'
END
WHERE review_status IS NULL;

UPDATE tb_ai_generation_task
SET failed_stage = CASE
    WHEN status = 'FAILED' AND current_step >= 3 THEN 'AI_REVIEW'
    WHEN status = 'FAILED' THEN 'GENERATION'
    ELSE NULL
END
WHERE failed_stage IS NULL;

UPDATE tb_ai_generation_task
SET error_code = CASE
    WHEN status = 'FAILED' AND current_step >= 3 THEN 'AI_REVIEW_FAILED'
    WHEN status = 'FAILED' THEN 'GENERATION_FAILED'
    ELSE NULL
END
WHERE error_code IS NULL;

ALTER TABLE tb_ai_generation_task ALTER COLUMN generation_status VARCHAR(32) DEFAULT 'PENDING' NOT NULL;
ALTER TABLE tb_ai_generation_task ALTER COLUMN review_status VARCHAR(32) DEFAULT 'NOT_STARTED' NOT NULL;
