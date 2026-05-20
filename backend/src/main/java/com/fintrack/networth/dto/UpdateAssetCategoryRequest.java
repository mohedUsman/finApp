package com.fintrack.networth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateAssetCategoryRequest(
        @Size(max = 80) String name,
        @Pattern(regexp = "bank|investment|cash|crypto|real_estate|gold|other") String kind,
        @Size(max = 20) String color,
        Boolean isActive,
        Integer sortOrder
) {}
