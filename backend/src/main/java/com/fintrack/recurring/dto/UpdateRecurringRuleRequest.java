package com.fintrack.recurring.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record UpdateRecurringRuleRequest(
        UUID categoryId,
        @Min(0) Long defaultExpectedAmountMinor,
        @Size(max = 500) String noteTemplate,
        String scheduleType,
        String scheduleConfig,
        LocalDate endDate,
        Boolean isActive
) {}
