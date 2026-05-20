package com.fintrack.networth.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record NetWorthSnapshotDto(
        UUID id,
        LocalDate snapshotDate,
        String balances,
        String note,
        Instant createdAt,
        Instant updatedAt
) {}
