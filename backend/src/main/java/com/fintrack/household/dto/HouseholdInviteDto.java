package com.fintrack.household.dto;

import java.time.Instant;
import java.util.UUID;

public record HouseholdInviteDto(UUID id, String email, String role, Instant expiresAt) {}
