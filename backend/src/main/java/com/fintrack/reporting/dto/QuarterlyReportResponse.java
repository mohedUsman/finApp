package com.fintrack.reporting.dto;

import java.util.List;

public record QuarterlyReportResponse(
        int year,
        int quarter,
        long totalActualIncomeMinor,
        long totalActualExpenseMinor,
        long totalExpectedIncomeMinor,
        long totalExpectedExpenseMinor,
        long netActualMinor,
        long netExpectedMinor,
        List<MonthSummaryDto> monthBreakdown,
        List<CategoryTotalDto> byCategoryQtd,
        long totalVarianceMinor
) {}
