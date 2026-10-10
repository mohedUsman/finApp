package com.fintrack.transaction.dto;

import com.fintrack.tag.dto.TagDto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record TransactionDto(
        UUID id,
        String type,
        UUID categoryId,
        String categoryName,
        String currencyCode,
        String status,
        Long expectedAmountMinor,
        LocalDate expectedDate,
        Long actualAmountMinor,
        LocalDate actualDate,
        String note,
        UUID recurringRuleId,
        String occurrenceKey,
        Instant confirmedAt,
        Instant createdAt,
        Instant updatedAt,
        List<TagDto> tags
) {}
