package com.company.autoplatform.testmanagement;

import com.company.autoplatform.common.BusinessException;
import org.springframework.http.HttpStatus;

import java.util.LinkedHashMap;
import java.util.Map;

public class TestManagementException extends BusinessException {

    private TestManagementException(HttpStatus status, String code, String message, Object details) {
        super(status, code, message, details);
    }

    public static TestManagementException validation(String message) {
        return validation(message, null);
    }

    public static TestManagementException validation(String message, Object details) {
        return new TestManagementException(HttpStatus.BAD_REQUEST, "TM_VALIDATION_FAILED", message, details);
    }

    public static TestManagementException permissionDenied(String message) {
        return new TestManagementException(HttpStatus.FORBIDDEN, "TM_PERMISSION_DENIED", message, null);
    }

    public static TestManagementException notFound(String resourceName, Object resourceId) {
        return new TestManagementException(
                HttpStatus.NOT_FOUND,
                "TM_RESOURCE_NOT_FOUND",
                resourceName + "不存在",
                details("resource", resourceName, "id", resourceId)
        );
    }

    public static TestManagementException conflict(String message, Object details) {
        return new TestManagementException(
                HttpStatus.CONFLICT,
                "TM_CONCURRENT_MODIFICATION",
                message,
                details
        );
    }

    public static TestManagementException invalidTransition(String resourceName, Object current, Object target) {
        return new TestManagementException(
                HttpStatus.CONFLICT,
                "TM_INVALID_TRANSITION",
                resourceName + "当前状态不允许变更为目标状态",
                details("currentStatus", current, "targetStatus", target)
        );
    }

    public static TestManagementException qualityGate(String message, Object failedChecks) {
        return new TestManagementException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "TM_QUALITY_GATE_FAILED",
                message,
                Map.of("failedChecks", failedChecks)
        );
    }

    public static TestManagementException duplicate(String message, Object details) {
        return new TestManagementException(HttpStatus.CONFLICT, "TM_DUPLICATE_CASE", message, details);
    }

    public static TestManagementException snapshotLocked(String message) {
        return new TestManagementException(HttpStatus.CONFLICT, "TM_SNAPSHOT_LOCKED", message, null);
    }

    public static TestManagementException reviewRequired(String message, Object details) {
        return new TestManagementException(HttpStatus.UNPROCESSABLE_ENTITY, "TM_REVIEW_REQUIRED", message, details);
    }

    private static Map<String, Object> details(String firstKey, Object firstValue, String secondKey, Object secondValue) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put(firstKey, firstValue);
        result.put(secondKey, secondValue);
        return result;
    }
}
