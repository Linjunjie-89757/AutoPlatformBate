package com.company.autoplatform.bug;

import com.company.autoplatform.common.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class BugAttachmentStorageService {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024L;

    private final Path storageRoot;

    public BugAttachmentStorageService(@Value("${app.bug.storage-root:./data/bug-files}") String storageRoot) {
        this.storageRoot = Paths.get(storageRoot).toAbsolutePath().normalize();
    }

    public List<StoredBugFile> storeAll(Long workspaceId, Long bugId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("请先选择要上传的附件");
        }
        files.forEach(this::validateFile);

        List<StoredBugFile> storedFiles = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                storedFiles.add(storeSingle(workspaceId, bugId, file));
            }
            return storedFiles;
        }
        catch (RuntimeException exception) {
            for (StoredBugFile storedFile : storedFiles) {
                delete(storedFile.storedPath());
            }
            throw exception;
        }
    }

    public void delete(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            return;
        }
        Path target = storageRoot.resolve(storedPath).normalize();
        try {
            Files.deleteIfExists(target);
            deleteEmptyParents(target.getParent());
        }
        catch (IOException ignored) {
        }
    }

    public void deleteBugDirectory(Long workspaceId, Long bugId) {
        if (workspaceId == null || bugId == null) {
            return;
        }
        Path target = storageRoot.resolve(Paths.get("workspace-" + workspaceId, "bug-" + bugId)).normalize();
        if (!target.startsWith(storageRoot) || target.equals(storageRoot) || !Files.exists(target)) {
            return;
        }
        try {
            List<Path> paths;
            try (var pathStream = Files.walk(target)) {
                paths = pathStream.sorted(Comparator.reverseOrder()).toList();
            }
            paths.forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    throw new UncheckedIOException(exception);
                }
            });
            deleteEmptyParents(target.getParent());
        } catch (IOException | UncheckedIOException ignored) {
        }
    }

    public BugFileDownload load(BugAttachmentEntity attachment) {
        Path target = storageRoot.resolve(attachment.getStoredPath()).normalize();
        try {
            Resource resource = new UrlResource(target.toUri());
            if (!resource.exists()) {
                throw new BadRequestException("附件文件不存在或已被清理");
            }
            return new BugFileDownload(
                    resource,
                    attachment.getFileName(),
                    normalizeContentType(attachment.getContentType()),
                    attachment.getFileSize() == null ? 0L : attachment.getFileSize()
            );
        }
        catch (MalformedURLException exception) {
            throw new BadRequestException("附件下载路径无效");
        }
    }

    private StoredBugFile storeSingle(Long workspaceId, Long bugId, MultipartFile file) {
        String originalName = cleanFileName(file);
        String storedName = buildStoredName(originalName);
        Path relativePath = Paths.get("workspace-" + workspaceId, "bug-" + bugId, storedName);
        Path target = storageRoot.resolve(relativePath).normalize();
        try {
            Files.createDirectories(target.getParent());
            file.transferTo(target);
        }
        catch (IOException exception) {
            throw new BadRequestException("附件保存失败");
        }
        return new StoredBugFile(relativePath.toString().replace('\\', '/'), normalizeContentType(file.getContentType()), file.getSize());
    }

    private void validateFile(MultipartFile file) {
        if (file == null || !StringUtils.hasText(file.getOriginalFilename())) {
            throw new BadRequestException("请先选择要上传的附件");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("附件大小不能超过 10MB");
        }
    }

    private String cleanFileName(MultipartFile file) {
        return StringUtils.cleanPath(file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename());
    }

    private void deleteEmptyParents(Path directory) throws IOException {
        Path current = directory;
        while (current != null && current.startsWith(storageRoot) && !current.equals(storageRoot)) {
            if (!Files.exists(current)) {
                current = current.getParent();
                continue;
            }
            try (var stream = Files.list(current)) {
                if (stream.findAny().isPresent()) {
                    return;
                }
            }
            Files.deleteIfExists(current);
            current = current.getParent();
        }
    }

    private String buildStoredName(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            return UUID.randomUUID().toString();
        }
        return UUID.randomUUID() + fileName.substring(dotIndex);
    }

    private String normalizeContentType(String contentType) {
        return (contentType == null || contentType.isBlank()) ? "application/octet-stream" : contentType;
    }
}
