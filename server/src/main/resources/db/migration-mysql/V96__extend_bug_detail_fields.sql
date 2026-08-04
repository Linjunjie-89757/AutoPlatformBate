ALTER TABLE tb_bug_info
    ADD COLUMN reproduction_steps TEXT NULL,
    ADD COLUMN expected_result TEXT NULL,
    ADD COLUMN actual_result TEXT NULL,
    ADD COLUMN module_name VARCHAR(128) NULL;
