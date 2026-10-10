package com.fintrack.household.dto;

import jakarta.validation.constraints.NotBlank;

public record AcceptInviteRequest(@NotBlank String token) {}
