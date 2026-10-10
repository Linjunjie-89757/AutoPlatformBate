CREATE INDEX IF NOT EXISTS idx_bug_flow_latest
    ON tb_bug_flow_record (bug_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_bug_comment_latest
    ON tb_bug_comment (bug_id, created_at, id);
