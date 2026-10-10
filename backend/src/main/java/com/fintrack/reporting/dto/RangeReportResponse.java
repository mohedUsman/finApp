package com.fintrack.reporting.dto;

import java.time.LocalDate;
import java.util.List;

public record RangeReportResponse(
        LocalDate from,
        LocalDate to,
        long totalActualIncomeMinor,
        long totalActualExpenseMinor,
        long totalExpectedIncomeMinor,
        long totalExpectedExpenseMinor,
        long netActualMinor,
        long netExpectedMinor,
        List<CategoryTotalDto> byCategory,
        List<DailyTrendDto> dailyActualTrend,
        long totalVarianceMinor
) {}
