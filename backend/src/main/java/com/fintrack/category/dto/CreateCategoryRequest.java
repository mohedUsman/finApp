package com.fintrack.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateCategoryRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Pattern(regexp = "INCOME|EXPENSE") String type,
        UUID parentId
) {}
