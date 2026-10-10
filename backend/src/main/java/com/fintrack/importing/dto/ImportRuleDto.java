package com.fintrack.importing.dto;

import java.util.UUID;

public record ImportRuleDto(UUID id, String keyword, UUID categoryId, String categoryName) {}
