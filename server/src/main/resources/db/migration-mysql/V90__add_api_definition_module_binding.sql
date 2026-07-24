ALTER TABLE tb_api_definition ADD COLUMN module_id BIGINT;

CREATE INDEX idx_api_definition_workspace_module_updated
    ON tb_api_definition (workspace_id, module_id, updated_at, id);
