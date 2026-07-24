package com.company.autoplatform.apiautomation;

import com.company.autoplatform.IntegrationTestSupport;
import com.company.autoplatform.workspace.CreateWorkspaceRequest;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.*;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class ApiAutomationListControllerIntegrationTests extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApiAutomationService apiAutomationService;

    @Autowired
    private ApiDefinitionMapper definitionMapper;

    @Autowired
    private WorkspaceService workspaceService;

    @Test
    void listDefinitionsWithoutParamsKeepsCompatibleLoading() throws Exception {
        String unique = uniquePrefix("defs-compatible");
        ApiDefinitionDetail definition = createDefinition(
                unique + "-definition",
                unique + "-module",
                "GET",
                "/api/" + unique + "/resource",
                "compatible"
        );

        mockMvc.perform(get("/api/automation/api/definitions")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items[*].id", hasItem(definition.id().intValue())));
    }

    @Test
    void listDefinitionsSupportsRootOnlyLoading() throws Exception {
        String unique = uniquePrefix("defs-root-only");
        ApiDefinitionDetail rootDefinition = createDefinition(
                unique + "-root", "", "GET", "/api/" + unique + "/root", "root");
        ApiDefinitionDetail nestedDefinition = createDefinition(
                unique + "-nested", unique + "-module", "GET", "/api/" + unique + "/nested", "nested");

        mockMvc.perform(get("/api/automation/api/definitions")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("rootOnly", "true")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(rootDefinition.id().intValue()))
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(nestedDefinition.id().intValue()))));
    }

    @Test
    void listDefinitionsSupportsKeywordModuleAndPaginationFilters() throws Exception {
        String unique = uniquePrefix("defs");
        ApiDefinitionModuleItem parentModule = apiAutomationService.createDefinitionModule(
                WORKSPACE_CODE,
                new ApiDefinitionModuleRequest(WORKSPACE_CODE, null, unique + "-parent")
        );
        ApiDefinitionModuleItem childModule = apiAutomationService.createDefinitionModule(
                WORKSPACE_CODE,
                new ApiDefinitionModuleRequest(WORKSPACE_CODE, parentModule.id(), unique + "-child")
        );

        ApiDefinitionDetail parentDefinition = createDefinition(
                unique + "-parent-definition",
                parentModule.fullPath(),
                "GET",
                "/api/" + unique + "/parent",
                "tag-parent"
        );
        ApiDefinitionDetail first = createDefinition(
                unique + "-alpha",
                childModule.fullPath(),
                "GET",
                "/api/" + unique + "/alpha",
                "tag-alpha"
        );
        ApiDefinitionDetail second = createDefinition(
                unique + "-beta",
                childModule.fullPath(),
                "POST",
                "/api/" + unique + "/beta",
                "tag-beta"
        );
        ApiDefinitionDetail outsideModule = createDefinition(
                unique + "-gamma",
                unique + "-other",
                "GET",
                "/api/" + unique + "/gamma",
                "tag-alpha"
        );

        mockMvc.perform(get("/api/automation/api/definition-modules")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.id == %s)].definitionCount", parentModule.id()).value(hasItem(3)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].directDefinitionCount", parentModule.id()).value(hasItem(1)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].children[0].definitionCount", parentModule.id()).value(hasItem(2)));

        mockMvc.perform(get("/api/automation/api/definition-modules/children")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.id == %s)].hasChildren", parentModule.id()).value(hasItem(true)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].definitionCount", parentModule.id()).value(hasItem(3)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].directDefinitionCount", parentModule.id()).value(hasItem(1)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].childrenLoaded", parentModule.id()).value(hasItem(false)));

        mockMvc.perform(get("/api/automation/api/definition-modules/children")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("parentId", parentModule.id().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(childModule.id().intValue()))
                .andExpect(jsonPath("$.data[0].definitionCount").value(2))
                .andExpect(jsonPath("$.data[0].directDefinitionCount").value(2))
                .andExpect(jsonPath("$.data[0].hasChildren").value(false))
                .andExpect(jsonPath("$.data[0].childrenLoaded").value(true));

        mockMvc.perform(get("/api/automation/api/definitions")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", "tag-alpha")
                        .param("moduleId", childModule.id().toString())
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.pageNo").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(10))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(first.id().intValue()))
                .andExpect(jsonPath("$.data.items[0].directoryName").value(childModule.fullPath()))
                .andExpect(jsonPath("$.data.items[0].tags", hasItem("tag-alpha")))
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(outsideModule.id().intValue()))));

        mockMvc.perform(get("/api/automation/api/definitions")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("moduleId", childModule.id().toString())
                        .param("pageNo", "2")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.pageNo").value(2))
                .andExpect(jsonPath("$.data.pageSize").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(first.id().intValue()));

        mockMvc.perform(get("/api/automation/api/definitions")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("moduleId", parentModule.id().toString())
                        .param("includeDescendants", "false")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(parentDefinition.id().intValue()));

        mockMvc.perform(get("/api/automation/api/definitions")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("moduleId", parentModule.id().toString())
                        .param("pageNo", "1")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.pageNo").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(3))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(outsideModule.id().intValue()))));
    }

    @Test
    void listDefinitionModulesBackfillsOnlyMissingLegacyPathsAndKeepsCounts() throws Exception {
        String unique = uniquePrefix("legacy-definition-module");
        WorkspaceEntity workspace = workspaceService.requireWorkspace(WORKSPACE_CODE);
        ApiDefinitionEntity legacyDefinition = new ApiDefinitionEntity();
        legacyDefinition.setWorkspaceId(workspace.getId());
        legacyDefinition.setDefinitionName(unique + "-definition");
        legacyDefinition.setHttpMethod("GET");
        legacyDefinition.setPath("/api/" + unique);
        legacyDefinition.setDirectoryName(unique + "/child");
        legacyDefinition.setCreatedAt(LocalDateTime.now());
        legacyDefinition.setUpdatedAt(LocalDateTime.now());
        definitionMapper.insert(legacyDefinition);

        mockMvc.perform(get("/api/automation/api/definition-modules")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.name == '%s')].definitionCount", unique).value(hasItem(1)))
                .andExpect(jsonPath("$.data[?(@.name == '%s')].children[0].name", unique).value(hasItem("child")))
                .andExpect(jsonPath("$.data[?(@.name == '%s')].children[0].definitionCount", unique).value(hasItem(1)));

        assertNotNull(definitionMapper.selectById(legacyDefinition.getId()).getModuleId());
    }

    @Test
    void searchDefinitionTreeReturnsAncestorPathsAndEmptyModules() throws Exception {
        String unique = uniquePrefix("definition-tree-search");
        ApiDefinitionModuleItem parentModule = apiAutomationService.createDefinitionModule(
                WORKSPACE_CODE,
                new ApiDefinitionModuleRequest(WORKSPACE_CODE, null, unique + "-parent")
        );
        ApiDefinitionModuleItem childModule = apiAutomationService.createDefinitionModule(
                WORKSPACE_CODE,
                new ApiDefinitionModuleRequest(WORKSPACE_CODE, parentModule.id(), "child-only")
        );
        ApiDefinitionModuleItem emptyModule = apiAutomationService.createDefinitionModule(
                WORKSPACE_CODE,
                new ApiDefinitionModuleRequest(WORKSPACE_CODE, parentModule.id(), "empty-" + unique)
        );
        ApiDefinitionDetail definition = createDefinition(
                unique + "-request",
                childModule.fullPath(),
                "GET",
                "/api/" + unique,
                "tree-search"
        );

        mockMvc.perform(get("/api/automation/api/definition-tree/search")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.definitionTotal").value(1))
                .andExpect(jsonPath("$.data.moduleTotal").value(2))
                .andExpect(jsonPath("$.data.definitions[0].id").value(definition.id().intValue()))
                .andExpect(jsonPath("$.data.definitions[0].moduleId").value(childModule.id().intValue()))
                .andExpect(jsonPath("$.data.modules[0].id").value(parentModule.id().intValue()))
                .andExpect(jsonPath("$.data.modules[0].children[*].id",
                        containsInAnyOrder(childModule.id().intValue(), emptyModule.id().intValue())));

        mockMvc.perform(get("/api/automation/api/definition-tree/search")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", "empty-" + unique)
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.definitionTotal").value(0))
                .andExpect(jsonPath("$.data.moduleTotal").value(1))
                .andExpect(jsonPath("$.data.modules[0].children[0].id").value(emptyModule.id().intValue()));
    }

    @Test
    void definitionTreeEndpointsKeepWorkspaceDataIsolated() throws Exception {
        String unique = uniquePrefix("definition-tree-workspace");
        String otherWorkspaceCode = "tree-" + Long.toString(System.nanoTime(), 36);
        workspaceService.createWorkspace(new CreateWorkspaceRequest(
                otherWorkspaceCode,
                "Directory tree isolation",
                "Integration test workspace",
                null,
                11L,
                1
        ));
        ApiDefinitionModuleItem currentModule = apiAutomationService.createDefinitionModule(
                WORKSPACE_CODE,
                new ApiDefinitionModuleRequest(WORKSPACE_CODE, null, unique + "-current")
        );
        ApiDefinitionModuleItem otherModule = apiAutomationService.createDefinitionModule(
                otherWorkspaceCode,
                new ApiDefinitionModuleRequest(otherWorkspaceCode, null, unique + "-other")
        );
        ApiDefinitionDetail currentDefinition = createDefinition(
                WORKSPACE_CODE,
                unique + "-current-definition",
                currentModule.fullPath(),
                "GET",
                "/api/" + unique + "/current",
                "workspace-isolation"
        );
        ApiDefinitionDetail otherDefinition = createDefinition(
                otherWorkspaceCode,
                unique + "-other-definition",
                otherModule.fullPath(),
                "GET",
                "/api/" + unique + "/other",
                "workspace-isolation"
        );

        mockMvc.perform(get("/api/automation/api/definition-modules/children")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].id", hasItem(currentModule.id().intValue())))
                .andExpect(jsonPath("$.data[*].id", not(hasItem(otherModule.id().intValue()))));

        mockMvc.perform(get("/api/automation/api/definition-modules/children")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("parentId", otherModule.id().toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/automation/api/definition-tree/search")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique)
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.definitions[*].id", hasItem(currentDefinition.id().intValue())))
                .andExpect(jsonPath("$.data.definitions[*].id", not(hasItem(otherDefinition.id().intValue()))))
                .andExpect(jsonPath("$.data.modules[*].id", hasItem(currentModule.id().intValue())))
                .andExpect(jsonPath("$.data.modules[*].id", not(hasItem(otherModule.id().intValue()))));

        mockMvc.perform(get("/api/automation/api/definitions")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("moduleId", otherModule.id().toString())
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void listCasesSupportsDefinitionKeywordAndPaginationFilters() throws Exception {
        String unique = uniquePrefix("cases");
        ApiDefinitionDetail definition = createDefinition(
                unique + "-definition",
                unique + "-module",
                "GET",
                "/api/" + unique + "/resource",
                "case-list"
        );
        ApiDefinitionDetail otherDefinition = createDefinition(
                unique + "-other-definition",
                unique + "-module",
                "GET",
                "/api/" + unique + "/other",
                "case-list"
        );
        ApiDefinitionCaseDetail first = createCase(definition.id(), unique + "-alpha-case", "case-alpha");
        ApiDefinitionCaseDetail second = createCase(definition.id(), unique + "-beta-case", "case-alpha");
        ApiDefinitionCaseDetail otherDefinitionCase = createCase(otherDefinition.id(), unique + "-other-case", "case-alpha");
        createCase(definition.id(), unique + "-gamma-case", "case-gamma");

        mockMvc.perform(get("/api/automation/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("definitionId", definition.id().toString())
                        .param("keyword", "case-alpha")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.pageNo").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(10))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[*].id", containsInAnyOrder(first.id().intValue(), second.id().intValue())))
                .andExpect(jsonPath("$.data.items[*].definitionId", containsInAnyOrder(definition.id().intValue(), definition.id().intValue())))
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(otherDefinitionCase.id().intValue()))));

        mockMvc.perform(get("/api/automation/api/cases")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("definitionId", definition.id().toString())
                        .param("keyword", "case-alpha")
                        .param("pageNo", "2")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.pageNo").value(2))
                .andExpect(jsonPath("$.data.pageSize").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(first.id().intValue()));
    }

    @Test
    void listScenariosWithoutParamsKeepsCompatibleLoading() throws Exception {
        String unique = uniquePrefix("scenarios-compatible");
        ApiScenarioDetail scenario = createScenario(
                unique + "-scenario",
                null,
                "IN_PROGRESS",
                "compatible scenario"
        );

        mockMvc.perform(get("/api/automation/api/scenarios")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items[*].id", hasItem(scenario.id().intValue())));
    }

    @Test
    void listScenariosSupportsKeywordModuleStatusAndPaginationFilters() throws Exception {
        String unique = uniquePrefix("scenarios");
        ApiScenarioModuleItem parentModule = apiAutomationService.createScenarioModule(
                WORKSPACE_CODE,
                new ApiScenarioModuleRequest(WORKSPACE_CODE, null, unique + "-parent")
        );
        ApiScenarioModuleItem childModule = apiAutomationService.createScenarioModule(
                WORKSPACE_CODE,
                new ApiScenarioModuleRequest(WORKSPACE_CODE, parentModule.id(), unique + "-child")
        );
        ApiScenarioModuleItem otherModule = apiAutomationService.createScenarioModule(
                WORKSPACE_CODE,
                new ApiScenarioModuleRequest(WORKSPACE_CODE, null, unique + "-other")
        );

        ApiScenarioDetail first = createScenario(
                unique + "-alpha",
                childModule.id(),
                "COMPLETED",
                unique + "-keyword"
        );
        ApiScenarioDetail second = createScenario(
                unique + "-beta",
                childModule.id(),
                "COMPLETED",
                unique + "-keyword"
        );
        ApiScenarioDetail outsideModule = createScenario(
                unique + "-outside",
                otherModule.id(),
                "COMPLETED",
                unique + "-keyword"
        );
        createScenario(
                unique + "-wrong-status",
                childModule.id(),
                "IN_PROGRESS",
                unique + "-keyword"
        );

        mockMvc.perform(get("/api/automation/api/scenarios")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique + "-keyword")
                        .param("moduleId", parentModule.id().toString())
                        .param("status", "completed")
                        .param("pageNo", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.pageNo").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(10))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[*].id", containsInAnyOrder(first.id().intValue(), second.id().intValue())))
                .andExpect(jsonPath("$.data.items[*].moduleId", containsInAnyOrder(childModule.id().intValue(), childModule.id().intValue())))
                .andExpect(jsonPath("$.data.items[*].status", containsInAnyOrder("COMPLETED", "COMPLETED")))
                .andExpect(jsonPath("$.data.items[*].id", not(hasItem(outsideModule.id().intValue()))));

        mockMvc.perform(get("/api/automation/api/scenarios")
                        .header(WorkspaceScope.HEADER, WORKSPACE_CODE)
                        .param("keyword", unique + "-keyword")
                        .param("moduleId", parentModule.id().toString())
                        .param("status", "COMPLETED")
                        .param("pageNo", "2")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.pageNo").value(2))
                .andExpect(jsonPath("$.data.pageSize").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(first.id().intValue()));
    }

    private ApiDefinitionDetail createDefinition(
            String name,
            String directoryName,
            String method,
            String path,
            String tag
    ) {
        return createDefinition(WORKSPACE_CODE, name, directoryName, method, path, tag);
    }

    private ApiDefinitionDetail createDefinition(
            String workspaceCode,
            String name,
            String directoryName,
            String method,
            String path,
            String tag
    ) {
        return apiAutomationService.createDefinition(workspaceCode, new SaveApiDefinitionRequest(
                workspaceCode,
                name,
                directoryName,
                "list regression",
                List.of(tag),
                requestConfig(method, path),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        ));
    }

    private ApiDefinitionCaseDetail createCase(Long definitionId, String name, String tag) {
        return apiAutomationService.createCase(WORKSPACE_CODE, new SaveApiDefinitionCaseRequest(
                WORKSPACE_CODE,
                definitionId,
                name,
                "list regression " + tag,
                List.of(tag),
                requestConfig("GET", "/case/" + name),
                List.of(),
                List.of(),
                List.of()
        ));
    }

    private ApiScenarioDetail createScenario(String name, Long moduleId, String status, String description) {
        return apiAutomationService.createScenario(WORKSPACE_CODE, new SaveApiScenarioRequest(
                WORKSPACE_CODE,
                name,
                null,
                moduleId,
                "P1",
                status,
                description,
                List.of("list-regression"),
                null,
                null,
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(new ApiScenarioStepInput(
                        null,
                        "List regression script",
                        "SCRIPT",
                        null,
                        null,
                        null,
                        true,
                        null,
                        List.of(),
                        List.of(),
                        List.of(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        "return true;",
                        List.of()
                ))
        ));
    }

    private ApiRequestConfigInput requestConfig(String method, String path) {
        return new ApiRequestConfigInput(
                method,
                path,
                5000,
                List.of(),
                List.of(),
                List.of(),
                new ApiRequestBodyInput("NONE", null, List.of(), null, null, null),
                new ApiAuthConfigInput("NONE", null, null)
        );
    }

    private String uniquePrefix(String label) {
        return "api-list-" + label + "-" + System.nanoTime();
    }
}
