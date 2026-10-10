package com.fintrack.goal.dto;

import java.time.LocalDate;
import java.util.UUID;

public record SavingsGoalDto(
        UUID id,
        String name,
        long targetAmountMinor,
        long savedAmountMinor,
        LocalDate targetDate
) {}
