package com.fintrack.importing.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Zero-based column indexes into the uploaded CSV.
 *
 * <p>Banks disagree on how they encode direction. Three shapes are supported:
 * a single signed amount column; separate debit and credit columns; or an
 * amount column plus a type column holding a word like DR/CR. Exactly one of
 * those must be resolvable, which {@code ImportService} checks.
 */
public record ColumnMapping(
        @NotNull @Min(0) Integer dateColumn,
        @NotNull @Min(0) Integer descriptionColumn,
        @Min(0) Integer amountColumn,
        @Min(0) Integer debitColumn,
        @Min(0) Integer creditColumn,
        @Min(0) Integer typeColumn,
        /** e.g. "dd/MM/yyyy". Null lets the parser try a list of common formats. */
        String dateFormat,
        boolean hasHeaderRow
) {}
