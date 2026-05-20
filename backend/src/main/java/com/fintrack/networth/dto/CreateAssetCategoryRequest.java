package com.fintrack.networth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateAssetCategoryRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Pattern(regexp = "bank|investment|cash|crypto|real_estate|gold|other") String kind,
        @Size(max = 20) String color
) {}
