package com.company.autoplatform.testmanagement;

public record TestQualityGateCheck(
        String key,
        String label,
        Object target,
        Object actual,
        boolean passed
) {
}
