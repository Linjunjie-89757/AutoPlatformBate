package com.company.autoplatform.apiautomation;

public class ApiDefinitionModuleNodeRow {

    private Long id;
    private Long workspaceId;
    private Long parentId;
    private String moduleName;
    private Integer sortOrder;
    private Long definitionCount;
    private Long directDefinitionCount;
    private Boolean hasChildren;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getWorkspaceId() {
        return workspaceId;
    }

    public void setWorkspaceId(Long workspaceId) {
        this.workspaceId = workspaceId;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public String getModuleName() {
        return moduleName;
    }

    public void setModuleName(String moduleName) {
        this.moduleName = moduleName;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Long getDefinitionCount() {
        return definitionCount;
    }

    public void setDefinitionCount(Long definitionCount) {
        this.definitionCount = definitionCount;
    }

    public Long getDirectDefinitionCount() {
        return directDefinitionCount;
    }

    public void setDirectDefinitionCount(Long directDefinitionCount) {
        this.directDefinitionCount = directDefinitionCount;
    }

    public Boolean getHasChildren() {
        return hasChildren;
    }

    public void setHasChildren(Boolean hasChildren) {
        this.hasChildren = hasChildren;
    }
}
