package com.fintrack.importing.dto;

import java.util.List;

public record ImportPreviewDto(
        List<String> headers,
        List<PreviewRowDto> rows,
        int totalRows,
        int importableRows,
        int duplicateRows,
        int errorRows
) {}
