package com.fintrack.importing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UpsertImportRuleRequest(
        @NotBlank @Size(max = 120) String keyword,
        @NotNull UUID categoryId
) {}
