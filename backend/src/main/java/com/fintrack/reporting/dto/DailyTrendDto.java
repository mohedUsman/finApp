package com.fintrack.reporting.dto;

import java.time.LocalDate;

public record DailyTrendDto(LocalDate date, long incomeMinor, long expenseMinor) {}
