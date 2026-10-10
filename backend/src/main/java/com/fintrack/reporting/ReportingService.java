package com.fintrack.reporting;

import com.fintrack.reporting.dto.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReportingService {

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public MonthlyReportResponse monthly(UUID userId, int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());

        // Actual totals
        long actualIncome = sumActual(userId, "INCOME", start, end);
        long actualExpense = sumActual(userId, "EXPENSE", start, end);

        // Expected totals (plan lens: all rows with expected_date in period)
        long expectedIncome = sumExpected(userId, "INCOME", start, end);
        long expectedExpense = sumExpected(userId, "EXPENSE", start, end);

        // Category breakdown (variance)
        List<CategoryTotalDto> byCategory = categoryBreakdown(userId, start, end);

        // Daily trends
        List<DailyTrendDto> dailyActual = dailyActualTrend(userId, start, end);
        List<DailyTrendDto> dailyExpected = dailyExpectedTrend(userId, start, end);

        // Status counts
        long expectedCount = countByStatus(userId, "EXPECTED", start, end);
        long actualCount = countByStatus(userId, "ACTUAL", start, end);

        long totalVariance = byCategory.stream().mapToLong(CategoryTotalDto::varianceMinor).sum();

        return new MonthlyReportResponse(year, month, actualIncome, actualExpense,
                expectedIncome, expectedExpense, actualIncome - actualExpense,
                expectedIncome - expectedExpense, byCategory, dailyActual, dailyExpected,
                expectedCount, actualCount, totalVariance);
    }

    @Transactional(readOnly = true)
    public QuarterlyReportResponse quarterly(UUID userId, int year, int quarter) {
        int startMonth = (quarter - 1) * 3 + 1;
        LocalDate start = LocalDate.of(year, startMonth, 1);
        LocalDate end = LocalDate.of(year, startMonth + 2, 1)
                .withDayOfMonth(LocalDate.of(year, startMonth + 2, 1).lengthOfMonth());

        long totalActualIncome = sumActual(userId, "INCOME", start, end);
        long totalActualExpense = sumActual(userId, "EXPENSE", start, end);
        long totalExpectedIncome = sumExpected(userId, "INCOME", start, end);
        long totalExpectedExpense = sumExpected(userId, "EXPENSE", start, end);

        List<MonthSummaryDto> months = new ArrayList<>();
        for (int m = startMonth; m <= startMonth + 2; m++) {
            LocalDate ms = LocalDate.of(year, m, 1);
            LocalDate me = ms.withDayOfMonth(ms.lengthOfMonth());
            months.add(new MonthSummaryDto(m,
                    sumActual(userId, "INCOME", ms, me), sumActual(userId, "EXPENSE", ms, me),
                    sumExpected(userId, "INCOME", ms, me), sumExpected(userId, "EXPENSE", ms, me),
                    sumActual(userId, "INCOME", ms, me) - sumActual(userId, "EXPENSE", ms, me),
                    sumExpected(userId, "INCOME", ms, me) - sumExpected(userId, "EXPENSE", ms, me)));
        }

        List<CategoryTotalDto> byCat = categoryBreakdown(userId, start, end);
        long totalVariance = byCat.stream().mapToLong(CategoryTotalDto::varianceMinor).sum();

        return new QuarterlyReportResponse(year, quarter, totalActualIncome, totalActualExpense,
                totalExpectedIncome, totalExpectedExpense,
                totalActualIncome - totalActualExpense, totalExpectedIncome - totalExpectedExpense,
                months, byCat, totalVariance);
    }

    @Transactional(readOnly = true)
    public RangeReportResponse range(UUID userId, LocalDate from, LocalDate to) {
        long actualIncome = sumActual(userId, "INCOME", from, to);
        long actualExpense = sumActual(userId, "EXPENSE", from, to);
        long expectedIncome = sumExpected(userId, "INCOME", from, to);
        long expectedExpense = sumExpected(userId, "EXPENSE", from, to);

        List<CategoryTotalDto> byCategory = categoryBreakdown(userId, from, to);
        List<DailyTrendDto> dailyActual = dailyActualTrend(userId, from, to);
        long totalVariance = byCategory.stream().mapToLong(CategoryTotalDto::varianceMinor).sum();

        return new RangeReportResponse(from, to, actualIncome, actualExpense, expectedIncome, expectedExpense,
                actualIncome - actualExpense, expectedIncome - expectedExpense, byCategory, dailyActual, totalVariance);
    }

    // Amounts are stored in their transaction's own currency. To sum them
    // meaningfully they're converted into the user's base currency using their
    // manually-entered exchange_rates (joined, never looked up in Java, to
    // keep reporting pure SQL). A transaction in the base currency, or any
    // currency with no rate on file, is treated as rate 1 (no conversion).
    private static final String FX_JOIN =
            "LEFT JOIN exchange_rates fx ON fx.user_id = t.user_id AND fx.currency_code = t.currency_code ";

    private long sumActual(UUID userId, String type, LocalDate start, LocalDate end) {
        String sql = "SELECT COALESCE(SUM(ROUND(t.actual_amount_minor * COALESCE(fx.rate_to_base, 1))), 0) " +
                "FROM transactions t " + FX_JOIN +
                "WHERE t.user_id = :uid AND t.type = :type AND t.status = 'ACTUAL' " +
                "AND t.actual_date BETWEEN :start AND :end";
        Object result = em.createNativeQuery(sql)
                .setParameter("uid", uuidToBytes(userId))
                .setParameter("type", type)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
        return toLong(result);
    }

    private long sumExpected(UUID userId, String type, LocalDate start, LocalDate end) {
        String sql = "SELECT COALESCE(SUM(ROUND(t.expected_amount_minor * COALESCE(fx.rate_to_base, 1))), 0) " +
                "FROM transactions t " + FX_JOIN +
                "WHERE t.user_id = :uid AND t.type = :type AND t.expected_date BETWEEN :start AND :end";
        Object result = em.createNativeQuery(sql)
                .setParameter("uid", uuidToBytes(userId))
                .setParameter("type", type)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
        return toLong(result);
    }

    private long countByStatus(UUID userId, String status, LocalDate start, LocalDate end) {
        String sql = "SELECT COUNT(*) FROM transactions WHERE user_id = :uid AND status = :status " +
                "AND (actual_date BETWEEN :start AND :end OR expected_date BETWEEN :start AND :end)";
        Object result = em.createNativeQuery(sql)
                .setParameter("uid", uuidToBytes(userId))
                .setParameter("status", status)
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
        return toLong(result);
    }

    @SuppressWarnings("unchecked")
    private List<CategoryTotalDto> categoryBreakdown(UUID userId, LocalDate start, LocalDate end) {
        String sql = "SELECT t.category_id, c.name, t.type, c.monthly_budget_minor, " +
                "COALESCE(SUM(ROUND(t.expected_amount_minor * COALESCE(fx.rate_to_base, 1))), 0) AS expected_total, " +
                "COALESCE(SUM(CASE WHEN t.status = 'ACTUAL' THEN ROUND(t.actual_amount_minor * COALESCE(fx.rate_to_base, 1)) ELSE 0 END), 0) AS actual_total " +
                "FROM transactions t JOIN categories c ON t.category_id = c.id " + FX_JOIN +
                "WHERE t.user_id = :uid AND t.expected_date BETWEEN :start AND :end " +
                "GROUP BY t.category_id, c.name, t.type, c.monthly_budget_minor";
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("uid", uuidToBytes(userId))
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();
        return rows.stream().map(r -> {
            UUID catId = bytesToUuid((byte[]) r[0]);
            String name = (String) r[1];
            String type = (String) r[2];
            Long budget = r[3] == null ? null : toLong(r[3]);
            long exp = toLong(r[4]);
            long act = toLong(r[5]);
            return new CategoryTotalDto(catId, name, type, exp, act, act - exp, budget);
        }).collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private List<DailyTrendDto> dailyActualTrend(UUID userId, LocalDate start, LocalDate end) {
        String sql = "SELECT t.actual_date, " +
                "COALESCE(SUM(CASE WHEN t.type='INCOME' THEN ROUND(t.actual_amount_minor * COALESCE(fx.rate_to_base, 1)) ELSE 0 END),0) AS income, " +
                "COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN ROUND(t.actual_amount_minor * COALESCE(fx.rate_to_base, 1)) ELSE 0 END),0) AS expense " +
                "FROM transactions t " + FX_JOIN +
                "WHERE t.user_id = :uid AND t.status = 'ACTUAL' " +
                "AND t.actual_date BETWEEN :start AND :end GROUP BY t.actual_date ORDER BY t.actual_date";
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("uid", uuidToBytes(userId))
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();
        return rows.stream().map(r -> new DailyTrendDto(
                ((java.sql.Date) r[0]).toLocalDate(), toLong(r[1]), toLong(r[2])
        )).collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private List<DailyTrendDto> dailyExpectedTrend(UUID userId, LocalDate start, LocalDate end) {
        String sql = "SELECT t.expected_date, " +
                "COALESCE(SUM(CASE WHEN t.type='INCOME' THEN ROUND(t.expected_amount_minor * COALESCE(fx.rate_to_base, 1)) ELSE 0 END),0) AS income, " +
                "COALESCE(SUM(CASE WHEN t.type='EXPENSE' THEN ROUND(t.expected_amount_minor * COALESCE(fx.rate_to_base, 1)) ELSE 0 END),0) AS expense " +
                "FROM transactions t " + FX_JOIN +
                "WHERE t.user_id = :uid " +
                "AND t.expected_date BETWEEN :start AND :end GROUP BY t.expected_date ORDER BY t.expected_date";
        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("uid", uuidToBytes(userId))
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();
        return rows.stream().map(r -> new DailyTrendDto(
                ((java.sql.Date) r[0]).toLocalDate(), toLong(r[1]), toLong(r[2])
        )).collect(Collectors.toList());
    }

    private byte[] uuidToBytes(UUID uuid) {
        java.nio.ByteBuffer bb = java.nio.ByteBuffer.wrap(new byte[16]);
        bb.putLong(uuid.getMostSignificantBits());
        bb.putLong(uuid.getLeastSignificantBits());
        return bb.array();
    }

    private UUID bytesToUuid(byte[] bytes) {
        java.nio.ByteBuffer bb = java.nio.ByteBuffer.wrap(bytes);
        return new UUID(bb.getLong(), bb.getLong());
    }

    private long toLong(Object value) {
        if (value == null) return 0L;
        if (value instanceof Long l) return l;
        if (value instanceof BigInteger bi) return bi.longValue();
        if (value instanceof Number n) return n.longValue();
        return 0L;
    }
}
