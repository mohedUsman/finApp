package com.fintrack.goal.dto;

import com.fintrack.transaction.dto.MoneyLimits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateSavingsGoalRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull @Min(0) @Max(MoneyLimits.MAX_AMOUNT_MINOR) Long targetAmountMinor,
        @Min(0) @Max(MoneyLimits.MAX_AMOUNT_MINOR) Long savedAmountMinor,
        LocalDate targetDate
) {}
