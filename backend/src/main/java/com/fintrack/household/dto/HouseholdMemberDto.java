package com.fintrack.household.dto;

import java.time.Instant;
import java.util.UUID;

public record HouseholdMemberDto(UUID id, String email, String role, Instant joinedAt) {}
