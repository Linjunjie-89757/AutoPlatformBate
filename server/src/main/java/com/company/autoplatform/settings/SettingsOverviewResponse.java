package com.company.autoplatform.settings;

public record SettingsOverviewResponse(
        CountMetric database,
        CountMetric environment,
        CountMetric notification,
        CountMetric parameter
) {

    public record CountMetric(long total, long enabled) {
    }
}
