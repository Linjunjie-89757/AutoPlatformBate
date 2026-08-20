package com.company.autoplatform.testmanagement;

import org.springframework.core.io.Resource;

record TestPlanExecutionFileDownload(Resource resource, String fileName, String contentType, long fileSize) {
}
