package com.fintrack.reporting.dto;

import java.util.UUID;

public record CategoryTotalDto(
        UUID categoryId,
        String categoryName,
        String type,
        long expectedAmountMinor,
        long actualAmountMinor,
        long varianceMinor
) {}
