package com.fintrack.goal.dto;

import jakarta.validation.constraints.NotNull;

public record ContributeRequest(@NotNull Long amountMinor) {}
