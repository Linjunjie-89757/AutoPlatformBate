ALTER TABLE tb_web_ui_case_step
    ADD COLUMN IF NOT EXISTS upload_artifact_json TEXT;

ALTER TABLE tb_web_ui_case_template_step
    ADD COLUMN IF NOT EXISTS upload_artifact_json TEXT;
