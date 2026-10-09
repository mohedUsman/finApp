package com.fintrack.transaction.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record CreateTransactionRequest(
        @NotBlank @Pattern(regexp = "INCOME|EXPENSE") String type,
        @NotNull UUID categoryId,
        @NotBlank @Pattern(regexp = "EXPECTED|ACTUAL") String status,
        @Min(0) @Max(MoneyLimits.MAX_AMOUNT_MINOR) Long expectedAmountMinor,
        LocalDate expectedDate,
        @Min(0) @Max(MoneyLimits.MAX_AMOUNT_MINOR) Long actualAmountMinor,
        LocalDate actualDate,
        @Size(max = 500) String note
) {}
