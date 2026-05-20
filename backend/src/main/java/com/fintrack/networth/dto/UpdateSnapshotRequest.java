package com.fintrack.networth.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateSnapshotRequest(
        LocalDate snapshotDate,
        String balances,
        @Size(max = 500) String note
) {}
