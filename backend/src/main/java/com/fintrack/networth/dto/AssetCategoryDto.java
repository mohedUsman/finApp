package com.fintrack.networth.dto;

import java.util.UUID;

public record AssetCategoryDto(
        UUID id,
        String name,
        String kind,
        String color,
        boolean isActive,
        boolean isDefault,
        int sortOrder
) {}
