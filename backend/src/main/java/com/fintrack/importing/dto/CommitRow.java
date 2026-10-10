package com.fintrack.importing.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record CommitRow(
        @NotNull LocalDate date,
        @NotNull @Min(0) Long amountMinor,
        @NotBlank @Pattern(regexp = "INCOME|EXPENSE") String type,
        @NotNull UUID categoryId,
        @Size(max = 500) String note,
        /** Remembers this row's description -> category choice for future imports. */
        boolean saveRule,
        @Size(max = 120) String ruleKeyword
) {}
