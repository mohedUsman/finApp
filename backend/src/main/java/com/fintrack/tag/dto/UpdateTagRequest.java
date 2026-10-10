package com.fintrack.tag.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateTagRequest(
        @Size(max = 50) String name,
        @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String color
) {}
