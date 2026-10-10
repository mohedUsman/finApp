package com.fintrack.household.dto;

import java.util.List;

/**
 * members and invites are populated only for an owner — a joined member sees
 * just their own role and whose household they're in.
 */
public record HouseholdView(
        boolean isOwner,
        String role,
        String ownerEmail,
        List<HouseholdMemberDto> members,
        List<HouseholdInviteDto> invites
) {}
