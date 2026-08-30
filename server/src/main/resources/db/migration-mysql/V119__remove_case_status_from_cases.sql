ALTER TABLE tb_case_info DROP COLUMN case_status;

UPDATE tb_case_info SET source_type = 'AI_GENERATED' WHERE source_type IN ('AI', 'AI生成', 'AI 生成');
UPDATE tb_case_info SET source_type = 'IMPORTED' WHERE source_type IN ('导入', 'IMPORT');
UPDATE tb_case_info SET source_type = 'MANUAL' WHERE source_type IN ('手工创建', '人工创建', 'MANUAL');
