package com.fintrack.importing.dto;

import java.util.List;

public record ImportResultDto(
        int importedCount,
        int rulesSavedCount,
        List<String> errors
) {}
