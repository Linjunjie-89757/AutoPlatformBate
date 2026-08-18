package com.company.autoplatform.testmanagement;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TestManagementStateMachineTests {

    @Test
    void acceptsConfiguredVersionTransitions() {
        assertThatCode(() -> TestManagementStateMachine.requireVersionTransition(
                VersionStatus.PLANNING,
                VersionStatus.DEVELOPING
        )).doesNotThrowAnyException();
        assertThat(TestManagementStateMachine.canTransitionVersion(
                VersionStatus.TESTING,
                VersionStatus.DEVELOPING
        )).isTrue();
        assertThat(TestManagementStateMachine.canTransitionVersion(
                VersionStatus.PENDING_RELEASE,
                VersionStatus.TESTING
        )).isTrue();
        assertThat(TestManagementStateMachine.canTransitionVersion(
                VersionStatus.RELEASED,
                VersionStatus.ARCHIVED
        )).isTrue();
    }

    @Test
    void rejectsInvalidVersionTransitionWithStableCode() {
        assertThatThrownBy(() -> TestManagementStateMachine.requireVersionTransition(
                VersionStatus.PLANNING,
                VersionStatus.RELEASED
        )).isInstanceOfSatisfying(TestManagementException.class, exception -> {
            assertThat(exception.code()).isEqualTo("TM_INVALID_TRANSITION");
            assertThat(exception.status().value()).isEqualTo(409);
        });
    }

    @Test
    void acceptsConfiguredPlanTransitions() {
        assertThat(TestManagementStateMachine.canTransitionPlan(PlanStatus.DRAFT, PlanStatus.PENDING)).isTrue();
        assertThat(TestManagementStateMachine.canTransitionPlan(PlanStatus.DRAFT, PlanStatus.RUNNING)).isTrue();
        assertThat(TestManagementStateMachine.canTransitionPlan(PlanStatus.RUNNING, PlanStatus.BLOCKED)).isTrue();
        assertThat(TestManagementStateMachine.canTransitionPlan(PlanStatus.BLOCKED, PlanStatus.RUNNING)).isTrue();
        assertThat(TestManagementStateMachine.canTransitionPlan(PlanStatus.BLOCKED, PlanStatus.COMPLETED)).isTrue();
    }

    @Test
    void rejectsTerminalPlanTransition() {
        assertThatThrownBy(() -> TestManagementStateMachine.requirePlanTransition(
                PlanStatus.COMPLETED,
                PlanStatus.RUNNING
        )).isInstanceOfSatisfying(TestManagementException.class, exception ->
                assertThat(exception.code()).isEqualTo("TM_INVALID_TRANSITION"));
    }
}
