package com.fintrack.networth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateSnapshotRequest(
        @NotNull LocalDate snapshotDate,
        @NotBlank String balances,
        @Size(max = 500) String note
) {}
