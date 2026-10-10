package com.fintrack.recurring.dto;

import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.UUID;

public record CreateRecurringRuleRequest(
        @NotBlank @Pattern(regexp = "INCOME|EXPENSE") String type,
        @NotNull UUID categoryId,
        @Pattern(regexp = "[A-Z]{3}") String currencyCode,
        @NotNull @Min(0) Long defaultExpectedAmountMinor,
        @Size(max = 500) String noteTemplate,
        @NotBlank @Pattern(regexp = "MONTHLY|WEEKLY|YEARLY") String scheduleType,
        @NotBlank String scheduleConfig,
        @NotNull LocalDate startDate,
        LocalDate endDate
) {}
