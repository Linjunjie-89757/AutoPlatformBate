ALTER TABLE tb_web_ui_case_step
    ADD COLUMN upload_artifact_json TEXT NULL;

ALTER TABLE tb_web_ui_case_template_step
    ADD COLUMN upload_artifact_json TEXT NULL;
