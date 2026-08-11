package com.company.autoplatform.workspace;

public record WorkspaceMemberCandidateItem(
        Long userId,
        String username,
        String email,
        String displayName,
        Integer status,
        boolean alreadyMember
) {
}
