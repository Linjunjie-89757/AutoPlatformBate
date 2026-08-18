package com.company.autoplatform.testmanagement;

import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

public final class TestManagementStateMachine {

    private static final Map<VersionStatus, Set<VersionStatus>> VERSION_TRANSITIONS = versionTransitions();
    private static final Map<PlanStatus, Set<PlanStatus>> PLAN_TRANSITIONS = planTransitions();

    private TestManagementStateMachine() {
    }

    public static void requireVersionTransition(VersionStatus current, VersionStatus target) {
        requireStates(current, target, "版本");
        if (!VERSION_TRANSITIONS.getOrDefault(current, Set.of()).contains(target)) {
            throw TestManagementException.invalidTransition("版本", current, target);
        }
    }

    public static boolean canTransitionVersion(VersionStatus current, VersionStatus target) {
        return current != null
                && target != null
                && VERSION_TRANSITIONS.getOrDefault(current, Set.of()).contains(target);
    }

    public static void requirePlanTransition(PlanStatus current, PlanStatus target) {
        requireStates(current, target, "测试计划");
        if (!PLAN_TRANSITIONS.getOrDefault(current, Set.of()).contains(target)) {
            throw TestManagementException.invalidTransition("测试计划", current, target);
        }
    }

    public static boolean canTransitionPlan(PlanStatus current, PlanStatus target) {
        return current != null
                && target != null
                && PLAN_TRANSITIONS.getOrDefault(current, Set.of()).contains(target);
    }

    private static void requireStates(Object current, Object target, String resourceName) {
        if (current == null || target == null) {
            throw TestManagementException.validation(resourceName + "状态不能为空");
        }
    }

    private static Map<VersionStatus, Set<VersionStatus>> versionTransitions() {
        Map<VersionStatus, Set<VersionStatus>> transitions = new EnumMap<>(VersionStatus.class);
        transitions.put(VersionStatus.PLANNING, Set.of(VersionStatus.DEVELOPING, VersionStatus.ARCHIVED));
        transitions.put(VersionStatus.DEVELOPING, Set.of(VersionStatus.TESTING, VersionStatus.ARCHIVED));
        transitions.put(VersionStatus.TESTING, Set.of(VersionStatus.DEVELOPING, VersionStatus.PENDING_RELEASE));
        transitions.put(VersionStatus.PENDING_RELEASE, Set.of(VersionStatus.TESTING, VersionStatus.RELEASED));
        transitions.put(VersionStatus.RELEASED, Set.of(VersionStatus.ARCHIVED));
        transitions.put(VersionStatus.ARCHIVED, Set.of());
        return Map.copyOf(transitions);
    }

    private static Map<PlanStatus, Set<PlanStatus>> planTransitions() {
        Map<PlanStatus, Set<PlanStatus>> transitions = new EnumMap<>(PlanStatus.class);
        transitions.put(PlanStatus.DRAFT, Set.of(PlanStatus.PENDING, PlanStatus.RUNNING, PlanStatus.CANCELLED));
        transitions.put(PlanStatus.PENDING, Set.of(PlanStatus.RUNNING, PlanStatus.CANCELLED));
        transitions.put(PlanStatus.RUNNING, Set.of(PlanStatus.BLOCKED, PlanStatus.COMPLETED, PlanStatus.CANCELLED));
        transitions.put(PlanStatus.BLOCKED, Set.of(PlanStatus.RUNNING, PlanStatus.COMPLETED, PlanStatus.CANCELLED));
        transitions.put(PlanStatus.COMPLETED, Set.of());
        transitions.put(PlanStatus.CANCELLED, Set.of());
        return Map.copyOf(transitions);
    }
}
