package com.fintrack.category.dto;

import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UpdateCategoryRequest(
        @Size(max = 80) String name,
        UUID parentId,
        Boolean isActive,
        Integer sortOrder
) {}
