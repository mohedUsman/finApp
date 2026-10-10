package com.fintrack.importing.dto;

import java.time.LocalDate;
import java.util.UUID;

/**
 * One parsed CSV line as it would be imported. {@code error} being non-null
 * means the row can't be imported at all; {@code duplicate} means an identical
 * transaction already exists and the row defaults to being skipped.
 */
public record PreviewRowDto(
        int lineNumber,
        LocalDate date,
        String description,
        Long amountMinor,
        String type,
        UUID suggestedCategoryId,
        String suggestedCategoryName,
        String matchedKeyword,
        boolean duplicate,
        String error
) {}
