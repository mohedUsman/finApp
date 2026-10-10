package com.fintrack.importing.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * The rows the user confirmed in the preview. The client sends back the parsed
 * values rather than the file, so what gets imported is exactly what was shown.
 */
public record CommitImportRequest(
        @NotEmpty @Valid List<CommitRow> rows
) {}
