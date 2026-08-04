package com.company.autoplatform.settings;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.company.autoplatform.common.BadRequestException;
import com.company.autoplatform.common.NotFoundException;
import com.company.autoplatform.common.PageResponse;
import com.company.autoplatform.workspace.WorkspaceEntity;
import com.company.autoplatform.workspace.WorkspaceScope;
import com.company.autoplatform.workspace.WorkspaceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.company.autoplatform.settings.ConfigReferenceModels.ConfigReferenceSummary;
import static com.company.autoplatform.settings.MockModels.*;

@Service
public class MockDomainService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final Pattern TEMPLATE_VARIABLE = Pattern.compile("\\{\\{\\s*([\\w.-]+)\\s*}}|\\$\\{\\s*([\\w.-]+)\\s*}");

    private final MockApplicationMapper applicationMapper;
    private final MockEndpointMapper endpointMapper;
    private final MockScenarioMapper scenarioMapper;
    private final MockBusinessScenarioMapper businessScenarioMapper;
    private final MockBusinessScenarioItemMapper businessScenarioItemMapper;
    private final MockCallLogMapper callLogMapper;
    private final MockReleaseMapper releaseMapper;
    private final MockExecutionCredentialService executionCredentialService;
    private final WorkspaceService workspaceService;
    private final ConfigReferenceDomainService referenceDomainService;
    private final boolean requireExecutionToken;

    public MockDomainService(
            MockApplicationMapper applicationMapper,
            MockEndpointMapper endpointMapper,
            MockScenarioMapper scenarioMapper,
            MockBusinessScenarioMapper businessScenarioMapper,
            MockBusinessScenarioItemMapper businessScenarioItemMapper,
            MockCallLogMapper callLogMapper,
            MockReleaseMapper releaseMapper,
            MockExecutionCredentialService executionCredentialService,
            WorkspaceService workspaceService,
            ConfigReferenceDomainService referenceDomainService,
            @org.springframework.beans.factory.annotation.Value("${autoplatform.mock.require-execution-token:false}") boolean requireExecutionToken
    ) {
        this.applicationMapper = applicationMapper;
        this.endpointMapper = endpointMapper;
        this.scenarioMapper = scenarioMapper;
        this.businessScenarioMapper = businessScenarioMapper;
        this.businessScenarioItemMapper = businessScenarioItemMapper;
        this.callLogMapper = callLogMapper;
        this.releaseMapper = releaseMapper;
        this.executionCredentialService = executionCredentialService;
        this.workspaceService = workspaceService;
        this.referenceDomainService = referenceDomainService;
        this.requireExecutionToken = requireExecutionToken;
    }

    public PageResponse<MockApplicationItem> listApplications(String workspaceCode, String keyword, Integer status) {
        LambdaQueryWrapper<MockApplicationEntity> query = scopedApplicationQuery(workspaceCode);
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(MockApplicationEntity::getAppName, trimmedKeyword)
                    .or()
                    .like(MockApplicationEntity::getAppCode, trimmedKeyword)
                    .or()
                    .like(MockApplicationEntity::getDescription, trimmedKeyword));
        }
        if (status != null) {
            query.eq(MockApplicationEntity::getStatus, normalizeStatus(status));
        }
        List<MockApplicationItem> items = applicationMapper.selectList(query.orderByDesc(MockApplicationEntity::getUpdatedAt))
                .stream()
                .map(this::toApplicationItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public MockApplicationItem createApplication(String headerWorkspaceCode, MockApplicationRequest request) {
        WorkspaceEntity workspace = workspaceService.requireWritableWorkspace(
                workspaceService.resolveTargetWorkspace(headerWorkspaceCode, request.workspaceCode()));
        MockApplicationEntity entity = new MockApplicationEntity();
        fillApplication(entity, workspace, request);
        ensureAppCodeUnique(workspace.getId(), entity.getAppCode(), null);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        applicationMapper.insert(entity);
        return toApplicationItem(entity);
    }

    public MockApplicationItem updateApplication(Long id, String headerWorkspaceCode, MockApplicationRequest request) {
        MockApplicationEntity entity = requireApplication(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该 Mock 应用");
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());
        fillApplication(entity, workspace, request);
        ensureAppCodeUnique(workspace.getId(), entity.getAppCode(), id);
        entity.setUpdatedAt(LocalDateTime.now());
        applicationMapper.updateById(entity);
        return toApplicationItem(entity);
    }

    public void deleteApplication(Long id, String workspaceCode) {
        MockApplicationEntity entity = requireApplication(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可删除该 Mock 应用");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        referenceDomainService.assertMockApplicationNotReferenced(id, entity.getWorkspaceId());
        List<MockEndpointEntity> endpoints = endpointMapper.selectList(new LambdaQueryWrapper<MockEndpointEntity>()
                .eq(MockEndpointEntity::getAppId, id));
        List<Long> endpointIds = endpoints.stream().map(MockEndpointEntity::getId).toList();
        if (!endpointIds.isEmpty()) {
            businessScenarioItemMapper.delete(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>().in(MockBusinessScenarioItemEntity::getEndpointId, endpointIds));
            scenarioMapper.delete(new LambdaQueryWrapper<MockScenarioEntity>().in(MockScenarioEntity::getEndpointId, endpointIds));
            endpointMapper.delete(new LambdaQueryWrapper<MockEndpointEntity>().in(MockEndpointEntity::getId, endpointIds));
        }
        businessScenarioMapper.delete(new LambdaQueryWrapper<MockBusinessScenarioEntity>().eq(MockBusinessScenarioEntity::getAppId, id));
        callLogMapper.delete(new LambdaQueryWrapper<MockCallLogEntity>().eq(MockCallLogEntity::getAppId, id));
        releaseMapper.delete(new LambdaQueryWrapper<MockReleaseEntity>().eq(MockReleaseEntity::getAppId, id));
        applicationMapper.deleteById(id);
    }

    public PageResponse<MockEndpointItem> listEndpoints(String workspaceCode, Long appId, String keyword, Integer status) {
        LambdaQueryWrapper<MockEndpointEntity> query = scopedEndpointQuery(workspaceCode);
        if (appId != null) {
            query.eq(MockEndpointEntity::getAppId, appId);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(MockEndpointEntity::getEndpointName, trimmedKeyword)
                    .or()
                    .like(MockEndpointEntity::getPathPattern, trimmedKeyword)
                    .or()
                    .like(MockEndpointEntity::getDescription, trimmedKeyword));
        }
        if (status != null) {
            query.eq(MockEndpointEntity::getStatus, normalizeStatus(status));
        }
        List<MockEndpointItem> items = endpointMapper.selectList(query.orderByDesc(MockEndpointEntity::getUpdatedAt))
                .stream()
                .map(this::toEndpointItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public MockEndpointItem createEndpoint(String headerWorkspaceCode, MockEndpointRequest request) {
        MockApplicationEntity application = requireApplication(request.appId());
        validateReadable(application.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该 Mock 接口");
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(application.getWorkspaceId());
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());
        MockEndpointEntity entity = new MockEndpointEntity();
        fillEndpoint(entity, application, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        endpointMapper.insert(entity);
        return toEndpointItem(entity);
    }

    public MockEndpointItem updateEndpoint(Long id, String headerWorkspaceCode, MockEndpointRequest request) {
        MockEndpointEntity entity = requireEndpoint(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该 Mock 接口");
        MockApplicationEntity application = requireApplication(entity.getAppId());
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        fillEndpoint(entity, application, request);
        entity.setUpdatedAt(LocalDateTime.now());
        endpointMapper.updateById(entity);
        return toEndpointItem(entity);
    }

    public void deleteEndpoint(Long id, String workspaceCode) {
        MockEndpointEntity entity = requireEndpoint(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可删除该 Mock 接口");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        businessScenarioItemMapper.delete(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>().eq(MockBusinessScenarioItemEntity::getEndpointId, id));
        scenarioMapper.delete(new LambdaQueryWrapper<MockScenarioEntity>().eq(MockScenarioEntity::getEndpointId, id));
        callLogMapper.delete(new LambdaQueryWrapper<MockCallLogEntity>().eq(MockCallLogEntity::getEndpointId, id));
        endpointMapper.deleteById(id);
    }

    public PageResponse<MockScenarioItem> listScenarios(String workspaceCode, Long endpointId, String keyword, Integer status) {
        LambdaQueryWrapper<MockScenarioEntity> query = scopedScenarioQuery(workspaceCode);
        if (endpointId != null) {
            query.eq(MockScenarioEntity::getEndpointId, endpointId);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(MockScenarioEntity::getScenarioName, trimmedKeyword)
                    .or()
                    .like(MockScenarioEntity::getMatchJson, trimmedKeyword)
                    .or()
                    .like(MockScenarioEntity::getResponseBody, trimmedKeyword));
        }
        if (status != null) {
            query.eq(MockScenarioEntity::getStatus, normalizeStatus(status));
        }
        List<MockScenarioItem> items = scenarioMapper.selectList(query.orderByAsc(MockScenarioEntity::getPriority).orderByDesc(MockScenarioEntity::getUpdatedAt))
                .stream()
                .map(this::toScenarioItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public MockScenarioItem createScenario(String headerWorkspaceCode, MockScenarioRequest request) {
        MockEndpointEntity endpoint = requireEndpoint(request.endpointId());
        validateReadable(endpoint.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该 Mock 场景");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(endpoint.getWorkspaceId()).getWorkspaceCode());
        MockScenarioEntity entity = new MockScenarioEntity();
        fillScenario(entity, endpoint, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioMapper.insert(entity);
        return toScenarioItem(entity);
    }

    public MockScenarioItem updateScenario(Long id, String headerWorkspaceCode, MockScenarioRequest request) {
        MockScenarioEntity entity = requireScenario(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该 Mock 场景");
        MockEndpointEntity endpoint = requireEndpoint(entity.getEndpointId());
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        fillScenario(entity, endpoint, request);
        entity.setUpdatedAt(LocalDateTime.now());
        scenarioMapper.updateById(entity);
        return toScenarioItem(entity);
    }

    public void deleteScenario(Long id, String workspaceCode) {
        MockScenarioEntity entity = requireScenario(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可删除该 Mock 场景");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        businessScenarioItemMapper.delete(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>().eq(MockBusinessScenarioItemEntity::getScenarioId, id));
        callLogMapper.delete(new LambdaQueryWrapper<MockCallLogEntity>().eq(MockCallLogEntity::getScenarioId, id));
        scenarioMapper.deleteById(id);
    }

    public PageResponse<MockBusinessScenarioItem> listBusinessScenarios(String workspaceCode, Long appId, String keyword, Integer status) {
        LambdaQueryWrapper<MockBusinessScenarioEntity> query = scopedBusinessScenarioQuery(workspaceCode);
        if (appId != null) {
            query.eq(MockBusinessScenarioEntity::getAppId, appId);
        }
        String trimmedKeyword = blankToNull(keyword);
        if (trimmedKeyword != null) {
            query.and(wrapper -> wrapper
                    .like(MockBusinessScenarioEntity::getScenarioName, trimmedKeyword)
                    .or()
                    .like(MockBusinessScenarioEntity::getDescription, trimmedKeyword));
        }
        if (status != null) {
            query.eq(MockBusinessScenarioEntity::getStatus, normalizeStatus(status));
        }
        List<MockBusinessScenarioItem> items = businessScenarioMapper.selectList(query.orderByDesc(MockBusinessScenarioEntity::getUpdatedAt))
                .stream()
                .map(this::toBusinessScenarioItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public MockBusinessScenarioItem createBusinessScenario(String headerWorkspaceCode, MockBusinessScenarioRequest request) {
        MockApplicationEntity application = requireApplication(request.appId());
        validateReadable(application.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该 Mock 业务场景");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(application.getWorkspaceId()).getWorkspaceCode());
        MockBusinessScenarioEntity entity = new MockBusinessScenarioEntity();
        fillBusinessScenario(entity, application, request);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        businessScenarioMapper.insert(entity);
        replaceBusinessScenarioItems(entity, request.items());
        return toBusinessScenarioItem(entity);
    }

    public MockBusinessScenarioItem updateBusinessScenario(Long id, String headerWorkspaceCode, MockBusinessScenarioRequest request) {
        MockBusinessScenarioEntity entity = requireBusinessScenario(id);
        validateReadable(entity.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可编辑该 Mock 业务场景");
        MockApplicationEntity application = requireApplication(entity.getAppId());
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        fillBusinessScenario(entity, application, request);
        entity.setUpdatedAt(LocalDateTime.now());
        businessScenarioMapper.updateById(entity);
        replaceBusinessScenarioItems(entity, request.items());
        return toBusinessScenarioItem(entity);
    }

    public void deleteBusinessScenario(Long id, String workspaceCode) {
        MockBusinessScenarioEntity entity = requireBusinessScenario(id);
        validateReadable(entity.getWorkspaceId(), workspaceCode, "当前空间上下文不可删除该 Mock 业务场景");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(entity.getWorkspaceId()).getWorkspaceCode());
        businessScenarioItemMapper.delete(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>().eq(MockBusinessScenarioItemEntity::getBusinessScenarioId, id));
        businessScenarioMapper.deleteById(id);
    }

    public PageResponse<MockCallLogItem> listCallLogs(String workspaceCode, Long appId, Long scenarioId) {
        LambdaQueryWrapper<MockCallLogEntity> query = scopedLogQuery(workspaceCode);
        if (appId != null) {
            query.eq(MockCallLogEntity::getAppId, appId);
        }
        if (scenarioId != null) {
            query.eq(MockCallLogEntity::getScenarioId, scenarioId);
        }
        List<MockCallLogItem> items = callLogMapper.selectList(query.orderByDesc(MockCallLogEntity::getCreatedAt).last("LIMIT 100"))
                .stream()
                .map(this::toCallLogItem)
                .toList();
        return new PageResponse<>(items, items.size());
    }

    public ConfigReferenceSummary applicationReferences(Long id, String workspaceCode) {
        return referenceDomainService.mockApplicationReferences(id, workspaceCode);
    }

    public List<MockReleaseItem> listReleases(Long appId, String workspaceCode) {
        MockApplicationEntity application = requireApplication(appId);
        validateReadable(application.getWorkspaceId(), workspaceCode, "当前空间上下文不可查看该 Mock 发布版本");
        return releaseMapper.selectList(new LambdaQueryWrapper<MockReleaseEntity>()
                        .eq(MockReleaseEntity::getAppId, appId)
                        .eq(MockReleaseEntity::getWorkspaceId, application.getWorkspaceId())
                        .orderByDesc(MockReleaseEntity::getVersionNo))
                .stream()
                .map(this::toReleaseItem)
                .toList();
    }

    @Transactional
    public MockReleaseItem publishRelease(Long appId, String headerWorkspaceCode, MockReleaseRequest request) {
        MockApplicationEntity application = requireApplication(appId);
        validateReadable(application.getWorkspaceId(), headerWorkspaceCode, "当前空间上下文不可发布该 Mock 应用");
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(application.getWorkspaceId());
        workspaceService.requireWritableWorkspace(workspace.getWorkspaceCode());

        List<MockEndpointEntity> endpoints = endpointMapper.selectList(new LambdaQueryWrapper<MockEndpointEntity>()
                .eq(MockEndpointEntity::getAppId, appId));
        if (endpoints.isEmpty()) {
            throw new BadRequestException("Mock 应用至少需要一个接口才能发布");
        }
        List<Long> endpointIds = endpoints.stream().map(MockEndpointEntity::getId).toList();
        List<MockScenarioEntity> scenarios = scenarioMapper.selectList(new LambdaQueryWrapper<MockScenarioEntity>()
                .in(MockScenarioEntity::getEndpointId, endpointIds));
        if (scenarios.isEmpty()) {
            throw new BadRequestException("Mock 应用至少需要一个场景才能发布");
        }
        List<MockBusinessScenarioEntity> businessScenarios = businessScenarioMapper.selectList(new LambdaQueryWrapper<MockBusinessScenarioEntity>()
                .eq(MockBusinessScenarioEntity::getAppId, appId));
        List<Long> businessScenarioIds = businessScenarios.stream().map(MockBusinessScenarioEntity::getId).toList();
        List<MockBusinessScenarioItemEntity> businessScenarioItems = businessScenarioIds.isEmpty()
                ? List.of()
                : businessScenarioItemMapper.selectList(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>()
                        .in(MockBusinessScenarioItemEntity::getBusinessScenarioId, businessScenarioIds));

        MockReleaseSnapshot snapshot = new MockReleaseSnapshot(
                new MockReleaseApplicationSnapshot(application.getId(), application.getAppName(), application.getAppCode(), application.getDescription(), application.getStatus()),
                endpoints.stream().map(item -> new MockReleaseEndpointSnapshot(item.getId(), item.getAppId(), item.getEndpointName(), item.getHttpMethod(), item.getPathPattern(), item.getDescription(), item.getStatus())).toList(),
                scenarios.stream().map(item -> new MockReleaseScenarioSnapshot(item.getId(), item.getAppId(), item.getEndpointId(), item.getScenarioName(), item.getPriority(), item.getMatchJson(), item.getResponseStatus(), item.getResponseHeadersJson(), item.getResponseBody(), item.getResponseDelayMs(), item.getVariablesJson(), item.getStatus())).toList(),
                businessScenarios.stream().map(item -> new MockReleaseBusinessScenarioSnapshot(
                        item.getId(), item.getAppId(), item.getScenarioName(), item.getDescription(), item.getVariablesJson(), item.getStatus(),
                        businessScenarioItems.stream()
                                .filter(step -> step.getBusinessScenarioId().equals(item.getId()))
                                .map(step -> new MockReleaseBusinessScenarioStepSnapshot(step.getId(), step.getEndpointId(), step.getScenarioId(), step.getSortOrder(), step.getStatus()))
                                .toList()
                )).toList()
        );

        String snapshotJson;
        try {
            snapshotJson = OBJECT_MAPPER.writeValueAsString(snapshot);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Mock 发布快照生成失败");
        }

        Integer latestVersion = releaseMapper.selectList(new LambdaQueryWrapper<MockReleaseEntity>()
                        .eq(MockReleaseEntity::getAppId, appId)
                        .orderByDesc(MockReleaseEntity::getVersionNo)
                        .last("LIMIT 1"))
                .stream()
                .findFirst()
                .map(MockReleaseEntity::getVersionNo)
                .orElse(0);
        releaseMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<MockReleaseEntity>()
                .eq(MockReleaseEntity::getAppId, appId)
                .set(MockReleaseEntity::getActive, 0));

        MockReleaseEntity release = new MockReleaseEntity();
        release.setWorkspaceId(application.getWorkspaceId());
        release.setAppId(appId);
        release.setVersionNo(latestVersion + 1);
        String releaseName = request == null ? null : request.releaseName();
        release.setReleaseName(blankToNull(releaseName) == null ? "v" + release.getVersionNo() : releaseName.trim());
        release.setSnapshotJson(snapshotJson);
        release.setActive(1);
        release.setCreatedAt(LocalDateTime.now());
        release.setUpdatedAt(LocalDateTime.now());
        releaseMapper.insert(release);
        return toReleaseItem(release);
    }

    @Transactional
    public MockReleaseItem activateRelease(Long appId, Long releaseId, String workspaceCode) {
        MockApplicationEntity application = requireApplication(appId);
        validateReadable(application.getWorkspaceId(), workspaceCode, "当前空间上下文不可启用该 Mock 发布版本");
        workspaceService.requireWritableWorkspace(workspaceService.requireWorkspaceById(application.getWorkspaceId()).getWorkspaceCode());
        MockReleaseEntity release = releaseMapper.selectById(releaseId);
        if (release == null || !appId.equals(release.getAppId()) || !application.getWorkspaceId().equals(release.getWorkspaceId())) {
            throw new NotFoundException("Mock 发布版本不存在");
        }
        releaseMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<MockReleaseEntity>()
                .eq(MockReleaseEntity::getAppId, appId)
                .set(MockReleaseEntity::getActive, 0));
        release.setActive(1);
        release.setUpdatedAt(LocalDateTime.now());
        releaseMapper.updateById(release);
        return toReleaseItem(release);
    }

    public ResponseEntity<String> invoke(String appCode, String mockPath, HttpServletRequest request, String body) {
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        MockApplicationEntity application = applicationMapper.selectOne(new LambdaQueryWrapper<MockApplicationEntity>()
                .eq(MockApplicationEntity::getAppCode, appCode)
                .eq(MockApplicationEntity::getStatus, 1)
                .last("LIMIT 1"));
        if (application == null) {
            return notMatched(null, null, null, method, mockPath, request, body, "APP_NOT_FOUND");
        }

        String workspaceCode = workspaceService.requireWorkspaceById(application.getWorkspaceId()).getWorkspaceCode();
        String requestedWorkspaceCode = request.getHeader(WorkspaceScope.HEADER);
        if (requestedWorkspaceCode != null
                && !requestedWorkspaceCode.isBlank()
                && !WorkspaceScope.ALL.equalsIgnoreCase(requestedWorkspaceCode.trim())
                && !workspaceCode.equals(requestedWorkspaceCode.trim())) {
            return notAuthorized(application, method, mockPath, request, body, "WORKSPACE_MISMATCH");
        }

        MockReleaseEntity release = null;
        String executionToken = request.getHeader(MockExecutionCredentialService.HEADER);
        if (executionToken != null && !executionToken.isBlank()) {
            var credential = executionCredentialService.validate(executionToken, workspaceCode, appCode);
            if (credential.isEmpty()) {
                return notAuthorized(application, method, mockPath, request, body, "INVALID_EXECUTION_TOKEN");
            }
            release = credential.get().releaseId() == null
                    ? readActiveReleaseEntity(application)
                    : releaseMapper.selectOne(new LambdaQueryWrapper<MockReleaseEntity>()
                            .eq(MockReleaseEntity::getId, credential.get().releaseId())
                            .eq(MockReleaseEntity::getAppId, application.getId())
                            .eq(MockReleaseEntity::getWorkspaceId, application.getWorkspaceId())
                            .last("LIMIT 1"));
            if (release == null) {
                return notAuthorized(application, method, mockPath, request, body, "RELEASE_NOT_FOUND");
            }
        } else {
            release = readActiveReleaseEntity(application);
            if (requireExecutionToken && release != null) {
                return notAuthorized(application, method, mockPath, request, body, "EXECUTION_TOKEN_REQUIRED");
            }
        }
        MockReleaseSnapshot releaseSnapshot = readReleaseSnapshot(release);
        List<MockEndpointEntity> endpoints = releaseSnapshot == null
                ? endpointMapper.selectList(new LambdaQueryWrapper<MockEndpointEntity>()
                        .eq(MockEndpointEntity::getAppId, application.getId())
                        .eq(MockEndpointEntity::getStatus, 1))
                : releaseSnapshot.endpoints().stream()
                        .filter(item -> item.status() == null || item.status() == 1)
                        .map(this::toEndpointEntity)
                        .toList();
        MockEndpointEntity endpoint = endpoints.stream()
                .filter(item -> methodMatches(item.getHttpMethod(), method))
                .filter(item -> pathMatches(item.getPathPattern(), mockPath))
                .findFirst()
                .orElse(null);
        if (endpoint == null) {
            return notMatched(application, null, null, method, mockPath, request, body, "ENDPOINT_NOT_FOUND", release);
        }

        List<Long> scopedScenarioIds = resolveBusinessScenarioIds(application, endpoint, request, releaseSnapshot);
        List<MockScenarioEntity> scenarios = releaseSnapshot == null
                ? scenarioMapper.selectList(new LambdaQueryWrapper<MockScenarioEntity>()
                        .eq(MockScenarioEntity::getEndpointId, endpoint.getId())
                        .eq(MockScenarioEntity::getStatus, 1)
                        .in(scopedScenarioIds != null, MockScenarioEntity::getId, scopedScenarioIds == null || scopedScenarioIds.isEmpty() ? List.of(-1L) : scopedScenarioIds)
                        .orderByAsc(MockScenarioEntity::getPriority)
                        .orderByDesc(MockScenarioEntity::getUpdatedAt))
                : releaseSnapshot.scenarios().stream()
                        .filter(item -> item.endpointId().equals(endpoint.getId()))
                        .filter(item -> item.status() == null || item.status() == 1)
                        .filter(item -> scopedScenarioIds == null || scopedScenarioIds.contains(item.id()))
                        .sorted(java.util.Comparator.comparing(item -> Optional.ofNullable(item.priority()).orElse(100)))
                        .map(this::toScenarioEntity)
                        .toList();
        MockScenarioEntity scenario = scenarios.stream()
                .filter(item -> matchScenario(item.getMatchJson(), request, body))
                .findFirst()
                .orElse(null);
        if (scenario == null) {
            return notMatched(application, endpoint, null, method, mockPath, request, body, "SCENARIO_NOT_FOUND", release);
        }

        if (scenario.getResponseDelayMs() != null && scenario.getResponseDelayMs() > 0) {
            try {
                Thread.sleep(Math.min(scenario.getResponseDelayMs(), 10000));
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        }
        Map<String, String> responseHeaders = readStringMap(scenario.getResponseHeadersJson());
        Map<String, String> templateVariables = buildTemplateVariables(scenario, request, body);
        String responseBody = renderTemplate(Optional.ofNullable(scenario.getResponseBody()).orElse(""), templateVariables);
        saveLog(application, endpoint, scenario, method, mockPath, request, body, scenario.getResponseStatus(), responseHeaders, responseBody, true, "MATCHED", release);
        HttpHeaders headers = new HttpHeaders();
        responseHeaders.forEach(headers::add);
        return new ResponseEntity<>(responseBody, headers, HttpStatus.valueOf(safeResponseStatus(scenario.getResponseStatus())));
    }

    private List<Long> resolveBusinessScenarioIds(MockApplicationEntity application, MockEndpointEntity endpoint, HttpServletRequest request, MockReleaseSnapshot releaseSnapshot) {
        String headerValue = request.getHeader("X-Mock-Business-Scenario-Id");
        if (headerValue == null || headerValue.isBlank()) {
            return null;
        }
        Long businessScenarioId;
        try {
            businessScenarioId = Long.parseLong(headerValue.trim());
        } catch (NumberFormatException exception) {
            return List.of(-1L);
        }
        List<Long> scenarioIds;
        if (releaseSnapshot != null) {
            MockReleaseBusinessScenarioSnapshot businessScenario = releaseSnapshot.businessScenarios().stream()
                    .filter(item -> item.id().equals(businessScenarioId))
                    .filter(item -> item.appId().equals(application.getId()))
                    .filter(item -> item.status() == null || item.status() == 1)
                    .findFirst()
                    .orElse(null);
            if (businessScenario == null) {
                return List.of(-1L);
            }
            scenarioIds = businessScenario.items().stream()
                    .filter(item -> item.endpointId().equals(endpoint.getId()))
                    .filter(item -> item.status() == null || item.status() == 1)
                    .sorted(java.util.Comparator.comparing(item -> Optional.ofNullable(item.sortOrder()).orElse(0)))
                    .map(MockReleaseBusinessScenarioStepSnapshot::scenarioId)
                    .toList();
        } else {
            MockBusinessScenarioEntity businessScenario = businessScenarioMapper.selectById(businessScenarioId);
            if (businessScenario == null
                    || !application.getWorkspaceId().equals(businessScenario.getWorkspaceId())
                    || !application.getId().equals(businessScenario.getAppId())
                    || businessScenario.getStatus() == null
                    || businessScenario.getStatus() == 0) {
                return List.of(-1L);
            }
            scenarioIds = businessScenarioItemMapper.selectList(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>()
                            .eq(MockBusinessScenarioItemEntity::getBusinessScenarioId, businessScenarioId)
                            .eq(MockBusinessScenarioItemEntity::getEndpointId, endpoint.getId())
                            .eq(MockBusinessScenarioItemEntity::getStatus, 1)
                            .orderByAsc(MockBusinessScenarioItemEntity::getSortOrder)
                            .orderByAsc(MockBusinessScenarioItemEntity::getId))
                    .stream()
                    .map(MockBusinessScenarioItemEntity::getScenarioId)
                    .toList();
        }
        return scenarioIds.isEmpty() ? List.of(-1L) : scenarioIds;
    }

    private MockReleaseEntity readActiveReleaseEntity(MockApplicationEntity application) {
        return releaseMapper.selectOne(new LambdaQueryWrapper<MockReleaseEntity>()
                .eq(MockReleaseEntity::getAppId, application.getId())
                .eq(MockReleaseEntity::getWorkspaceId, application.getWorkspaceId())
                .eq(MockReleaseEntity::getActive, 1)
                .orderByDesc(MockReleaseEntity::getVersionNo)
                .last("LIMIT 1"));
    }

    private MockReleaseSnapshot readReleaseSnapshot(MockReleaseEntity release) {
        if (release == null) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(release.getSnapshotJson(), MockReleaseSnapshot.class);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("当前 Mock 发布版本快照无效");
        }
    }

    private ResponseEntity<String> notAuthorized(MockApplicationEntity application, String method, String path, HttpServletRequest request, String body, String status) {
        String responseBody = "{\"success\":false,\"message\":\"Mock execution is not authorized\"}";
        saveLog(application, null, null, method, path, request, body, 401, Map.of("Content-Type", "application/json;charset=UTF-8"), responseBody, false, status, null);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(responseBody);
    }

    private MockEndpointEntity toEndpointEntity(MockReleaseEndpointSnapshot snapshot) {
        MockEndpointEntity entity = new MockEndpointEntity();
        entity.setId(snapshot.id());
        entity.setWorkspaceId(null);
        entity.setAppId(snapshot.appId());
        entity.setEndpointName(snapshot.endpointName());
        entity.setHttpMethod(snapshot.httpMethod());
        entity.setPathPattern(snapshot.pathPattern());
        entity.setDescription(snapshot.description());
        entity.setStatus(snapshot.status());
        return entity;
    }

    private MockScenarioEntity toScenarioEntity(MockReleaseScenarioSnapshot snapshot) {
        MockScenarioEntity entity = new MockScenarioEntity();
        entity.setId(snapshot.id());
        entity.setAppId(snapshot.appId());
        entity.setEndpointId(snapshot.endpointId());
        entity.setScenarioName(snapshot.scenarioName());
        entity.setPriority(snapshot.priority());
        entity.setMatchJson(snapshot.matchJson());
        entity.setResponseStatus(snapshot.responseStatus());
        entity.setResponseHeadersJson(snapshot.responseHeadersJson());
        entity.setResponseBody(snapshot.responseBody());
        entity.setResponseDelayMs(snapshot.responseDelayMs());
        entity.setVariablesJson(snapshot.variablesJson());
        entity.setStatus(snapshot.status());
        return entity;
    }

    private ResponseEntity<String> notMatched(MockApplicationEntity application, MockEndpointEntity endpoint, MockScenarioEntity scenario, String method, String path, HttpServletRequest request, String body, String status) {
        return notMatched(application, endpoint, scenario, method, path, request, body, status, null);
    }

    private ResponseEntity<String> notMatched(MockApplicationEntity application, MockEndpointEntity endpoint, MockScenarioEntity scenario, String method, String path, HttpServletRequest request, String body, String status, MockReleaseEntity release) {
        String responseBody = "{\"success\":false,\"message\":\"Mock not matched\"}";
        saveLog(application, endpoint, scenario, method, path, request, body, 404, Map.of("Content-Type", "application/json;charset=UTF-8"), responseBody, false, status, release);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(responseBody);
    }

    private void fillApplication(MockApplicationEntity entity, WorkspaceEntity workspace, MockApplicationRequest request) {
        entity.setWorkspaceId(workspace.getId());
        entity.setAppName(request.appName().trim());
        entity.setAppCode(normalizeCode(request.appCode()));
        entity.setDescription(blankToNull(request.description()));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
    }

    private void fillEndpoint(MockEndpointEntity entity, MockApplicationEntity application, MockEndpointRequest request) {
        entity.setWorkspaceId(application.getWorkspaceId());
        entity.setAppId(application.getId());
        entity.setEndpointName(request.endpointName().trim());
        entity.setHttpMethod(normalizeMethod(request.httpMethod()));
        entity.setPathPattern(normalizePath(request.pathPattern()));
        entity.setDescription(blankToNull(request.description()));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
    }

    private void fillScenario(MockScenarioEntity entity, MockEndpointEntity endpoint, MockScenarioRequest request) {
        entity.setWorkspaceId(endpoint.getWorkspaceId());
        entity.setAppId(endpoint.getAppId());
        entity.setEndpointId(endpoint.getId());
        entity.setScenarioName(request.scenarioName().trim());
        entity.setPriority(request.priority() == null ? 100 : Math.max(0, request.priority()));
        entity.setMatchJson(blankToDefaultJson(request.matchJson(), "{}"));
        entity.setResponseStatus(safeResponseStatus(request.responseStatus()));
        entity.setResponseHeadersJson(blankToDefaultJson(request.responseHeadersJson(), "{}"));
        entity.setResponseBody(Optional.ofNullable(request.responseBody()).orElse(""));
        entity.setResponseDelayMs(request.responseDelayMs() == null ? 0 : Math.max(0, request.responseDelayMs()));
        entity.setVariablesJson(blankToDefaultJson(request.variablesJson(), "{}"));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
    }

    private void fillBusinessScenario(MockBusinessScenarioEntity entity, MockApplicationEntity application, MockBusinessScenarioRequest request) {
        entity.setWorkspaceId(application.getWorkspaceId());
        entity.setAppId(application.getId());
        entity.setScenarioName(request.scenarioName().trim());
        entity.setDescription(blankToNull(request.description()));
        entity.setVariablesJson(blankToDefaultJson(request.variablesJson(), "{}"));
        entity.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
    }

    private void replaceBusinessScenarioItems(MockBusinessScenarioEntity businessScenario, List<MockBusinessScenarioItemRequest> requests) {
        businessScenarioItemMapper.delete(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>()
                .eq(MockBusinessScenarioItemEntity::getBusinessScenarioId, businessScenario.getId()));
        int index = 0;
        for (MockBusinessScenarioItemRequest request : Optional.ofNullable(requests).orElse(List.of())) {
            if (request == null || request.scenarioId() == null) {
                continue;
            }
            MockScenarioEntity scenario = requireScenario(request.scenarioId());
            MockEndpointEntity endpoint = requireEndpoint(scenario.getEndpointId());
            if (!businessScenario.getWorkspaceId().equals(scenario.getWorkspaceId())
                    || !businessScenario.getAppId().equals(scenario.getAppId())
                    || request.endpointId() != null && !request.endpointId().equals(scenario.getEndpointId())) {
                throw new BadRequestException("Mock 业务场景条目必须属于同一个 Mock 应用");
            }
            MockBusinessScenarioItemEntity item = new MockBusinessScenarioItemEntity();
            item.setWorkspaceId(businessScenario.getWorkspaceId());
            item.setBusinessScenarioId(businessScenario.getId());
            item.setAppId(businessScenario.getAppId());
            item.setEndpointId(endpoint.getId());
            item.setScenarioId(scenario.getId());
            item.setSortOrder(request.sortOrder() == null ? index : request.sortOrder());
            item.setStatus(request.status() == null ? 1 : normalizeStatus(request.status()));
            item.setCreatedAt(LocalDateTime.now());
            item.setUpdatedAt(LocalDateTime.now());
            businessScenarioItemMapper.insert(item);
            index++;
        }
    }

    private boolean matchScenario(String matchJson, HttpServletRequest request, String body) {
        Map<String, String> rules = readStringMap(matchJson);
        String queryContains = rules.get("queryContains");
        if (queryContains != null && !Optional.ofNullable(request.getQueryString()).orElse("").contains(queryContains)) {
            return false;
        }
        String bodyContains = rules.get("bodyContains");
        if (bodyContains != null && !Optional.ofNullable(body).orElse("").contains(bodyContains)) {
            return false;
        }
        String headerName = rules.get("headerName");
        String headerValue = rules.get("headerValue");
        if (headerName != null && headerValue != null && !headerValue.equals(request.getHeader(headerName))) {
            return false;
        }
        if (!matchKeyValueRules(matchJson, "query", readQueryParams(request))) {
            return false;
        }
        if (!matchKeyValueRules(matchJson, "headers", readHeaders(request))) {
            return false;
        }
        if (!matchJsonPathRule(matchJson, body)) {
            return false;
        }
        return true;
    }

    private void saveLog(MockApplicationEntity application, MockEndpointEntity endpoint, MockScenarioEntity scenario, String method, String path, HttpServletRequest request, String body, Integer responseStatus, Map<String, String> responseHeaders, String responseBody, boolean matched, String status) {
        saveLog(application, endpoint, scenario, method, path, request, body, responseStatus, responseHeaders, responseBody, matched, status, null);
    }

    private void saveLog(MockApplicationEntity application, MockEndpointEntity endpoint, MockScenarioEntity scenario, String method, String path, HttpServletRequest request, String body, Integer responseStatus, Map<String, String> responseHeaders, String responseBody, boolean matched, String status, MockReleaseEntity release) {
        MockCallLogEntity log = new MockCallLogEntity();
        log.setWorkspaceId(application == null ? 0L : application.getWorkspaceId());
        log.setAppId(application == null ? null : application.getId());
        log.setEndpointId(endpoint == null ? null : endpoint.getId());
        log.setScenarioId(scenario == null ? null : scenario.getId());
        log.setBusinessScenarioId(readBusinessScenarioId(request));
        log.setReleaseId(release == null ? null : release.getId());
        log.setReleaseVersion(release == null ? null : release.getVersionNo());
        log.setHttpMethod(method);
        log.setRequestPath(path);
        log.setRequestHeadersJson(toJson(readHeaders(request)));
        log.setRequestBody(Optional.ofNullable(body).orElse(""));
        log.setResponseStatus(responseStatus);
        log.setResponseHeadersJson(toJson(responseHeaders == null ? Map.of() : responseHeaders));
        log.setResponseBody(Optional.ofNullable(responseBody).orElse(""));
        log.setMatched(matched ? 1 : 0);
        log.setStatus(status);
        log.setCreatedAt(LocalDateTime.now());
        log.setUpdatedAt(LocalDateTime.now());
        callLogMapper.insert(log);
    }

    private Long readBusinessScenarioId(HttpServletRequest request) {
        String value = request.getHeader("X-Mock-Business-Scenario-Id");
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Map<String, String> readQueryParams(HttpServletRequest request) {
        LinkedHashMap<String, String> params = new LinkedHashMap<>();
        String queryString = request.getQueryString();
        if (queryString == null || queryString.isBlank()) {
            return params;
        }
        for (String part : queryString.split("&")) {
            if (part.isBlank()) {
                continue;
            }
            String[] pair = part.split("=", 2);
            String key = URLDecoder.decode(pair[0], StandardCharsets.UTF_8);
            String value = pair.length > 1 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : "";
            params.put(key, value);
        }
        return params;
    }

    private Map<String, String> readHeaders(HttpServletRequest request) {
        LinkedHashMap<String, String> headers = new LinkedHashMap<>();
        Enumeration<String> names = request.getHeaderNames();
        while (names != null && names.hasMoreElements()) {
            String name = names.nextElement();
            headers.put(name, request.getHeader(name));
        }
        return headers;
    }

    private boolean methodMatches(String configured, String method) {
        String normalized = normalizeMethod(configured);
        return "ANY".equals(normalized) || normalized.equals(method);
    }

    private boolean pathMatches(String pattern, String path) {
        String normalizedPattern = normalizePath(pattern);
        String normalizedPath = normalizePath(path);
        if (normalizedPattern.endsWith("/**")) {
            return normalizedPath.startsWith(normalizedPattern.substring(0, normalizedPattern.length() - 3));
        }
        return normalizedPattern.equals(normalizedPath);
    }

    private boolean matchKeyValueRules(String matchJson, String fieldName, Map<String, String> actualValues) {
        JsonNode node = readJsonNode(matchJson);
        JsonNode expected = node == null ? null : node.get(fieldName);
        if (expected == null || expected.isNull() || expected.isMissingNode()) {
            return true;
        }
        if (!expected.isObject()) {
            return true;
        }
        var fields = expected.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String actual = actualValues.get(entry.getKey());
            String expectedValue = entry.getValue().isTextual() ? entry.getValue().asText() : entry.getValue().toString();
            if (!expectedValue.equals(actual)) {
                return false;
            }
        }
        return true;
    }

    private boolean matchJsonPathRule(String matchJson, String body) {
        JsonNode ruleRoot = readJsonNode(matchJson);
        if (ruleRoot == null) {
            return true;
        }
        String expression = textValue(ruleRoot, "bodyJsonPath");
        String expectedValue = textValue(ruleRoot, "bodyJsonValue");
        JsonNode jsonPathRules = ruleRoot.get("jsonPath");
        if (jsonPathRules != null && jsonPathRules.isObject()) {
            expression = textValue(jsonPathRules, "path");
            expectedValue = textValue(jsonPathRules, "value");
        }
        if (expression == null || expression.isBlank()) {
            return true;
        }
        JsonNode bodyRoot = readJsonNode(body);
        if (bodyRoot == null) {
            return false;
        }
        JsonNode actualNode = resolveSimpleJsonPath(bodyRoot, expression);
        if (actualNode == null || actualNode.isMissingNode() || actualNode.isNull()) {
            return false;
        }
        if (expectedValue == null) {
            return true;
        }
        String actualValue = actualNode.isTextual() ? actualNode.asText() : actualNode.toString();
        return expectedValue.equals(actualValue);
    }

    private JsonNode resolveSimpleJsonPath(JsonNode root, String expression) {
        String normalized = expression.trim();
        if (normalized.startsWith("$.")) {
            normalized = normalized.substring(2);
        } else if (normalized.startsWith("$")) {
            normalized = normalized.substring(1);
        }
        if (normalized.startsWith(".")) {
            normalized = normalized.substring(1);
        }
        JsonNode current = root;
        for (String segment : normalized.split("\\.")) {
            if (segment.isBlank()) {
                continue;
            }
            current = current == null ? null : current.get(segment);
        }
        return current;
    }

    private Map<String, String> buildTemplateVariables(MockScenarioEntity scenario, HttpServletRequest request, String body) {
        LinkedHashMap<String, String> variables = new LinkedHashMap<>();
        variables.putAll(readStringMap(scenario.getVariablesJson()));
        variables.putAll(readQueryParams(request));
        JsonNode bodyRoot = readJsonNode(body);
        if (bodyRoot != null && bodyRoot.isObject()) {
            bodyRoot.fields().forEachRemaining(entry -> {
                JsonNode value = entry.getValue();
                variables.putIfAbsent(entry.getKey(), value.isTextual() ? value.asText() : value.toString());
            });
        }
        return variables;
    }

    private String renderTemplate(String template, Map<String, String> variables) {
        if (template == null || template.isBlank() || variables == null || variables.isEmpty()) {
            return Optional.ofNullable(template).orElse("");
        }
        Matcher matcher = TEMPLATE_VARIABLE.matcher(template);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1) == null ? matcher.group(2) : matcher.group(1);
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(Optional.ofNullable(variables.get(key)).orElse("")));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private LambdaQueryWrapper<MockApplicationEntity> scopedApplicationQuery(String workspaceCode) {
        LambdaQueryWrapper<MockApplicationEntity> query = new LambdaQueryWrapper<>();
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null) {
            query.eq(MockApplicationEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            if (workspaceIds.isEmpty()) {
                query.eq(MockApplicationEntity::getWorkspaceId, -1L);
            } else {
                query.in(MockApplicationEntity::getWorkspaceId, workspaceIds);
            }
        }
        return query;
    }

    private LambdaQueryWrapper<MockEndpointEntity> scopedEndpointQuery(String workspaceCode) {
        LambdaQueryWrapper<MockEndpointEntity> query = new LambdaQueryWrapper<>();
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null) {
            query.eq(MockEndpointEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            query.in(MockEndpointEntity::getWorkspaceId, workspaceIds.isEmpty() ? List.of(-1L) : workspaceIds);
        }
        return query;
    }

    private LambdaQueryWrapper<MockScenarioEntity> scopedScenarioQuery(String workspaceCode) {
        LambdaQueryWrapper<MockScenarioEntity> query = new LambdaQueryWrapper<>();
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null) {
            query.eq(MockScenarioEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            query.in(MockScenarioEntity::getWorkspaceId, workspaceIds.isEmpty() ? List.of(-1L) : workspaceIds);
        }
        return query;
    }

    private LambdaQueryWrapper<MockBusinessScenarioEntity> scopedBusinessScenarioQuery(String workspaceCode) {
        LambdaQueryWrapper<MockBusinessScenarioEntity> query = new LambdaQueryWrapper<>();
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null) {
            query.eq(MockBusinessScenarioEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            query.in(MockBusinessScenarioEntity::getWorkspaceId, workspaceIds.isEmpty() ? List.of(-1L) : workspaceIds);
        }
        return query;
    }

    private LambdaQueryWrapper<MockCallLogEntity> scopedLogQuery(String workspaceCode) {
        LambdaQueryWrapper<MockCallLogEntity> query = new LambdaQueryWrapper<>();
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null) {
            query.eq(MockCallLogEntity::getWorkspaceId, workspace.getId());
        } else if (!workspaceService.isPlatformAdmin()) {
            List<Long> workspaceIds = workspaceService.listReadableWorkspaceIds();
            query.in(MockCallLogEntity::getWorkspaceId, workspaceIds.isEmpty() ? List.of(-1L) : workspaceIds);
        }
        return query;
    }

    private MockApplicationEntity requireApplication(Long id) {
        if (id == null) {
            throw new BadRequestException("Mock 应用不能为空");
        }
        MockApplicationEntity entity = applicationMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Mock 应用不存在");
        }
        return entity;
    }

    private MockEndpointEntity requireEndpoint(Long id) {
        if (id == null) {
            throw new BadRequestException("Mock 接口不能为空");
        }
        MockEndpointEntity entity = endpointMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Mock 接口不存在");
        }
        return entity;
    }

    private MockScenarioEntity requireScenario(Long id) {
        if (id == null) {
            throw new BadRequestException("Mock 场景不能为空");
        }
        MockScenarioEntity entity = scenarioMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Mock 场景不存在");
        }
        return entity;
    }

    private MockBusinessScenarioEntity requireBusinessScenario(Long id) {
        if (id == null) {
            throw new BadRequestException("Mock 业务场景不能为空");
        }
        MockBusinessScenarioEntity entity = businessScenarioMapper.selectById(id);
        if (entity == null) {
            throw new NotFoundException("Mock 业务场景不存在");
        }
        return entity;
    }

    private void validateReadable(Long workspaceId, String workspaceCode, String message) {
        WorkspaceEntity workspace = resolveScopedWorkspace(workspaceCode);
        if (workspace != null && !workspace.getId().equals(workspaceId)) {
            throw new BadRequestException(message);
        }
        if (workspace == null && !workspaceService.isPlatformAdmin()
                && !workspaceService.listReadableWorkspaceIds().contains(workspaceId)) {
            throw new BadRequestException(message);
        }
    }

    private WorkspaceEntity resolveScopedWorkspace(String workspaceCode) {
        String normalized = WorkspaceScope.normalize(workspaceCode);
        return WorkspaceScope.isAll(normalized) ? null : workspaceService.requireReadableWorkspace(normalized);
    }

    private MockApplicationItem toApplicationItem(MockApplicationEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        return new MockApplicationItem(entity.getId(), workspace.getWorkspaceCode(), workspace.getWorkspaceName(),
                entity.getAppName(), entity.getAppCode(), entity.getDescription(), entity.getStatus());
    }

    private MockEndpointItem toEndpointItem(MockEndpointEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        MockApplicationEntity application = applicationMapper.selectById(entity.getAppId());
        return new MockEndpointItem(entity.getId(), workspace.getWorkspaceCode(), workspace.getWorkspaceName(),
                entity.getAppId(), application == null ? "-" : application.getAppName(), entity.getEndpointName(),
                entity.getHttpMethod(), entity.getPathPattern(), entity.getDescription(), entity.getStatus());
    }

    private MockScenarioItem toScenarioItem(MockScenarioEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        MockApplicationEntity application = applicationMapper.selectById(entity.getAppId());
        MockEndpointEntity endpoint = endpointMapper.selectById(entity.getEndpointId());
        return new MockScenarioItem(entity.getId(), workspace.getWorkspaceCode(), workspace.getWorkspaceName(),
                entity.getAppId(), application == null ? "-" : application.getAppName(), entity.getEndpointId(),
                endpoint == null ? "-" : endpoint.getEndpointName(), entity.getScenarioName(), entity.getPriority(),
                entity.getMatchJson(), entity.getResponseStatus(), entity.getResponseHeadersJson(), entity.getResponseBody(),
                entity.getResponseDelayMs(), entity.getVariablesJson(), entity.getStatus());
    }

    private MockBusinessScenarioItem toBusinessScenarioItem(MockBusinessScenarioEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        MockApplicationEntity application = applicationMapper.selectById(entity.getAppId());
        List<MockBusinessScenarioStepItem> items = businessScenarioItemMapper.selectList(new LambdaQueryWrapper<MockBusinessScenarioItemEntity>()
                        .eq(MockBusinessScenarioItemEntity::getBusinessScenarioId, entity.getId())
                        .orderByAsc(MockBusinessScenarioItemEntity::getSortOrder)
                        .orderByAsc(MockBusinessScenarioItemEntity::getId))
                .stream()
                .map(this::toBusinessScenarioStepItem)
                .toList();
        return new MockBusinessScenarioItem(entity.getId(), workspace.getWorkspaceCode(), workspace.getWorkspaceName(),
                entity.getAppId(), application == null ? "-" : application.getAppName(), entity.getScenarioName(),
                entity.getDescription(), entity.getVariablesJson(), entity.getStatus(), items);
    }

    private MockBusinessScenarioStepItem toBusinessScenarioStepItem(MockBusinessScenarioItemEntity entity) {
        MockEndpointEntity endpoint = endpointMapper.selectById(entity.getEndpointId());
        MockScenarioEntity scenario = scenarioMapper.selectById(entity.getScenarioId());
        return new MockBusinessScenarioStepItem(entity.getId(), entity.getBusinessScenarioId(), entity.getAppId(),
                entity.getEndpointId(), endpoint == null ? "-" : endpoint.getEndpointName(), entity.getScenarioId(),
                scenario == null ? "-" : scenario.getScenarioName(), entity.getSortOrder(), entity.getStatus());
    }

    private MockCallLogItem toCallLogItem(MockCallLogEntity entity) {
        WorkspaceEntity workspace = entity.getWorkspaceId() == null || entity.getWorkspaceId() == 0
                ? null
                : workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        MockApplicationEntity application = entity.getAppId() == null ? null : applicationMapper.selectById(entity.getAppId());
        MockEndpointEntity endpoint = entity.getEndpointId() == null ? null : endpointMapper.selectById(entity.getEndpointId());
        MockScenarioEntity scenario = entity.getScenarioId() == null ? null : scenarioMapper.selectById(entity.getScenarioId());
        MockBusinessScenarioEntity businessScenario = entity.getBusinessScenarioId() == null ? null : businessScenarioMapper.selectById(entity.getBusinessScenarioId());
        return new MockCallLogItem(entity.getId(), workspace == null ? "-" : workspace.getWorkspaceCode(),
                workspace == null ? "-" : workspace.getWorkspaceName(), entity.getAppId(),
                application == null ? null : application.getAppName(), entity.getEndpointId(),
                endpoint == null ? null : endpoint.getEndpointName(), entity.getScenarioId(),
                scenario == null ? null : scenario.getScenarioName(), entity.getBusinessScenarioId(),
                businessScenario == null ? null : businessScenario.getScenarioName(), entity.getReleaseId(), entity.getReleaseVersion(), entity.getHttpMethod(), entity.getRequestPath(),
                entity.getRequestHeadersJson(), entity.getRequestBody(), entity.getResponseStatus(),
                entity.getResponseHeadersJson(), entity.getResponseBody(),
                entity.getMatched() != null && entity.getMatched() == 1, entity.getStatus(), entity.getCreatedAt());
    }

    private MockReleaseItem toReleaseItem(MockReleaseEntity entity) {
        WorkspaceEntity workspace = workspaceService.requireWorkspaceById(entity.getWorkspaceId());
        MockApplicationEntity application = applicationMapper.selectById(entity.getAppId());
        return new MockReleaseItem(entity.getId(), workspace.getWorkspaceCode(), workspace.getWorkspaceName(),
                entity.getAppId(), application == null ? "-" : application.getAppName(), entity.getVersionNo(),
                entity.getReleaseName(), entity.getActive() != null && entity.getActive() == 1, entity.getCreatedAt());
    }

    private void ensureAppCodeUnique(Long workspaceId, String appCode, Long excludeId) {
        LambdaQueryWrapper<MockApplicationEntity> query = new LambdaQueryWrapper<MockApplicationEntity>()
                .eq(MockApplicationEntity::getWorkspaceId, workspaceId)
                .eq(MockApplicationEntity::getAppCode, appCode);
        if (excludeId != null) {
            query.ne(MockApplicationEntity::getId, excludeId);
        }
        if (applicationMapper.selectCount(query) > 0) {
            throw new BadRequestException("当前空间下 Mock 应用编码已存在");
        }
    }

    private String normalizeCode(String value) {
        String code = Optional.ofNullable(value).orElse("").trim();
        if (!code.matches("[A-Za-z0-9_-]{2,64}")) {
            throw new BadRequestException("Mock 应用编码只能包含字母、数字、下划线和中划线，长度 2-64");
        }
        return code;
    }

    private String normalizeMethod(String value) {
        String method = Optional.ofNullable(value).orElse("ANY").trim().toUpperCase(Locale.ROOT);
        if (!List.of("ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS").contains(method)) {
            throw new BadRequestException("不支持的请求方法: " + method);
        }
        return method;
    }

    private String normalizePath(String value) {
        String path = Optional.ofNullable(value).orElse("").trim();
        if (path.isEmpty()) {
            return "/";
        }
        return path.startsWith("/") ? path : "/" + path;
    }

    private Integer normalizeStatus(Integer status) {
        if (status == null || (status != 0 && status != 1)) {
            throw new BadRequestException("状态只能是 0 或 1");
        }
        return status;
    }

    private int safeResponseStatus(Integer status) {
        int value = status == null ? 200 : status;
        return value < 100 || value > 599 ? 200 : value;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String blankToDefaultJson(String value, String fallback) {
        String text = blankToNull(value);
        return text == null ? fallback : text;
    }

    private Map<String, String> readStringMap(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<>() {
            });
        } catch (JsonProcessingException exception) {
            return Map.of();
        }
    }

    private JsonNode readJsonNode(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private String textValue(JsonNode node, String fieldName) {
        JsonNode value = node == null ? null : node.get(fieldName);
        if (value == null || value.isNull()) {
            return null;
        }
        return value.isTextual() ? value.asText() : value.toString();
    }

    private String toJson(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }
}
