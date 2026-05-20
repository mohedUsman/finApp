package com.fintrack.reporting.dto;

import java.util.List;

public record MonthlyReportResponse(
        int year,
        int month,
        long totalActualIncomeMinor,
        long totalActualExpenseMinor,
        long totalExpectedIncomeMinor,
        long totalExpectedExpenseMinor,
        long netActualMinor,
        long netExpectedMinor,
        List<CategoryTotalDto> byCategory,
        List<DailyTrendDto> dailyActualTrend,
        List<DailyTrendDto> dailyExpectedTrend,
        long expectedTransactionCount,
        long actualTransactionCount,
        long totalVarianceMinor
) {}
