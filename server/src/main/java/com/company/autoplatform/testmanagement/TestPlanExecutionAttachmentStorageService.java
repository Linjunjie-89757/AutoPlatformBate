package com.company.autoplatform.testmanagement;

import com.company.autoplatform.common.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class TestPlanExecutionAttachmentStorageService {
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024L;
    private final Path storageRoot;

    public TestPlanExecutionAttachmentStorageService(
            @Value("${app.test-management.execution-storage-root:./data/test-plan-execution-files}") String storageRoot) {
        this.storageRoot = Paths.get(storageRoot).toAbsolutePath().normalize();
    }

    public List<StoredTestPlanExecutionFile> storeAll(Long workspaceId, Long planId, Long executionId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) throw new BadRequestException("请先选择要上传的证据文件");
        files.forEach(this::validate);
        List<StoredTestPlanExecutionFile> result = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? "evidence" : file.getOriginalFilename());
                String extension = original.contains(".") ? original.substring(original.lastIndexOf('.')) : "";
                String executionDirectory = executionId == null ? "execution-pending" : "execution-" + executionId;
                Path relative = Paths.get("workspace-" + workspaceId, "plan-" + planId, executionDirectory, UUID.randomUUID() + extension);
                Path target = storageRoot.resolve(relative).normalize();
                Files.createDirectories(target.getParent());
                file.transferTo(target);
                result.add(new StoredTestPlanExecutionFile(relative.toString().replace('\\', '/'), contentType(file.getContentType()), file.getSize()));
            }
            return result;
        } catch (IOException | RuntimeException exception) {
            result.forEach(item -> delete(item.storedPath()));
            throw new BadRequestException("执行证据保存失败");
        }
    }

    public TestPlanExecutionFileDownload load(TestPlanExecutionAttachmentEntity attachment) {
        Path target = storageRoot.resolve(attachment.getStoredPath()).normalize();
        try {
            Resource resource = new UrlResource(target.toUri());
            if (!resource.exists()) throw new BadRequestException("执行证据文件不存在或已被清理");
            return new TestPlanExecutionFileDownload(resource, attachment.getFileName(), contentType(attachment.getContentType()), attachment.getFileSize() == null ? 0 : attachment.getFileSize());
        } catch (MalformedURLException exception) {
            throw new BadRequestException("执行证据下载路径无效");
        }
    }

    public void delete(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) return;
        try { Files.deleteIfExists(storageRoot.resolve(storedPath).normalize()); } catch (IOException ignored) { }
    }

    private void validate(MultipartFile file) {
        if (file == null || !StringUtils.hasText(file.getOriginalFilename())) throw new BadRequestException("请先选择要上传的证据文件");
        if (file.getSize() > MAX_FILE_SIZE) throw new BadRequestException("单个执行证据不能超过20MB");
    }

    private String contentType(String value) { return value == null || value.isBlank() ? "application/octet-stream" : value; }
}
