ALTER TABLE tb_bug_flow_record
    ADD KEY idx_bug_flow_latest (bug_id, created_at, id);

ALTER TABLE tb_bug_comment
    ADD KEY idx_bug_comment_latest (bug_id, created_at, id);
