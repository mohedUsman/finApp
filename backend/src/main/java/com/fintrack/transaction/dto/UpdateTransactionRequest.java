package com.fintrack.transaction.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record UpdateTransactionRequest(
        UUID categoryId,
        String status,
        Long expectedAmountMinor,
        LocalDate expectedDate,
        Long actualAmountMinor,
        LocalDate actualDate,
        @Size(max = 500) String note
) {}
