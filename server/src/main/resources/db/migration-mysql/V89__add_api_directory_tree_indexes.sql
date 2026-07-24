CREATE INDEX idx_api_definition_workspace_directory_updated
    ON tb_api_definition (workspace_id, directory_name, updated_at, id);

CREATE INDEX idx_api_definition_module_workspace_parent_sort
    ON tb_api_definition_module (workspace_id, parent_id, sort_order, id);
