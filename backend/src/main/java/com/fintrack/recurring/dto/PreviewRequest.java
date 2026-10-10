package com.fintrack.recurring.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;

public record PreviewRequest(
        @NotBlank @Pattern(regexp = "MONTHLY|WEEKLY|YEARLY") String scheduleType,
        @NotBlank String scheduleConfig,
        @NotNull LocalDate startDate,
        LocalDate endDate
) {}
