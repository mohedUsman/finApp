package com.fintrack.category.dto;

import java.util.UUID;

public record CategoryDto(
        UUID id,
        UUID userId,
        String type,
        String name,
        UUID parentId,
        boolean isDefault,
        boolean isActive,
        int sortOrder,
        Long monthlyBudgetMinor
) {}
