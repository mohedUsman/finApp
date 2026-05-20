package com.fintrack.reporting.dto;

public record MonthSummaryDto(
        int month,
        long actualIncomeMinor,
        long actualExpenseMinor,
        long expectedIncomeMinor,
        long expectedExpenseMinor,
        long netActualMinor,
        long netExpectedMinor
) {}
