package com.company.autoplatform.webuiautomation;

import com.company.autoplatform.common.BadRequestException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import static com.company.autoplatform.webuiautomation.WebUiAutomationFormatSupport.blankToNull;
import static com.company.autoplatform.webuiautomation.WebUiAutomationModels.WebUiUploadArtifactBinding;

@Component
public class WebUiUploadArtifactBindingSupport {

    private final ObjectMapper objectMapper;

    public WebUiUploadArtifactBindingSupport(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper == null ? new ObjectMapper() : objectMapper;
    }

    public String write(WebUiUploadArtifactBinding binding) {
        if (binding == null) {
            return null;
        }
        String fileId = blankToNull(binding.fileId());
        String contentBase64 = blankToNull(binding.contentBase64());
        if (fileId == null || contentBase64 == null) {
            throw new BadRequestException("Upload artifact binding is invalid");
        }
        try {
            return objectMapper.writeValueAsString(new WebUiUploadArtifactBinding(
                    fileId,
                    blankToNull(binding.fileName()) == null ? fileId : blankToNull(binding.fileName()),
                    blankToNull(binding.contentType()) == null ? "application/octet-stream" : blankToNull(binding.contentType()),
                    contentBase64,
                    binding.size()
            ));
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Upload artifact binding is invalid");
        }
    }

    public WebUiUploadArtifactBinding read(String uploadArtifactJson) {
        String normalized = blankToNull(uploadArtifactJson);
        if (normalized == null) {
            return null;
        }
        try {
            WebUiUploadArtifactBinding binding = objectMapper.readValue(normalized, WebUiUploadArtifactBinding.class);
            if (binding == null) {
                return null;
            }
            String fileId = blankToNull(binding.fileId());
            String contentBase64 = blankToNull(binding.contentBase64());
            if (fileId == null || contentBase64 == null) {
                return null;
            }
            return new WebUiUploadArtifactBinding(
                    fileId,
                    blankToNull(binding.fileName()) == null ? fileId : blankToNull(binding.fileName()),
                    blankToNull(binding.contentType()) == null ? "application/octet-stream" : blankToNull(binding.contentType()),
                    contentBase64,
                    binding.size()
            );
        } catch (JsonProcessingException exception) {
            return null;
        }
    }
}
