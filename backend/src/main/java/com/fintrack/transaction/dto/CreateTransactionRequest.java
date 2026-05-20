package com.fintrack.transaction.dto;

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
        Long expectedAmountMinor,
        LocalDate expectedDate,
        Long actualAmountMinor,
        LocalDate actualDate,
        @Size(max = 500) String note
) {}
