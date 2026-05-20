package com.fintrack.recurring.dto;

import java.time.LocalDate;
import java.util.UUID;

public record RecurringRuleDto(
        UUID id,
        String type,
        UUID categoryId,
        String categoryName,
        String currencyCode,
        Long defaultExpectedAmountMinor,
        String noteTemplate,
        String scheduleType,
        String scheduleConfig,
        LocalDate startDate,
        LocalDate endDate,
        LocalDate nextRunDate,
        boolean isActive
) {}
