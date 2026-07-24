package com.company.autoplatform.apiautomation;

public class ApiDefinitionDirectoryCountRow {

    private Long workspaceId;
    private String directoryName;
    private Long definitionCount;

    public ApiDefinitionDirectoryCountRow() {
    }

    public ApiDefinitionDirectoryCountRow(Long workspaceId, String directoryName, Long definitionCount) {
        this.workspaceId = workspaceId;
        this.directoryName = directoryName;
        this.definitionCount = definitionCount;
    }

    public Long getWorkspaceId() {
        return workspaceId;
    }

    public void setWorkspaceId(Long workspaceId) {
        this.workspaceId = workspaceId;
    }

    public String getDirectoryName() {
        return directoryName;
    }

    public void setDirectoryName(String directoryName) {
        this.directoryName = directoryName;
    }

    public Long getDefinitionCount() {
        return definitionCount;
    }

    public void setDefinitionCount(Long definitionCount) {
        this.definitionCount = definitionCount;
    }
}
