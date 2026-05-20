package com.fintrack.transaction.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ConfirmTransactionRequest(
        @NotNull @Min(0) Long actualAmountMinor,
        @NotNull LocalDate actualDate,
        @Size(max = 500) String note
) {}
