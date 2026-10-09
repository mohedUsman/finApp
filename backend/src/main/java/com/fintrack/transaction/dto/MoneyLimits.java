package com.fintrack.transaction.dto;

/**
 * Upper bound for monetary amounts, in minor units (paise).
 *
 * <p>Without a ceiling, a single row near {@code Long.MAX_VALUE} makes the
 * {@code SUM()} in the reporting queries overflow and wrap negative. This cap
 * (₹1 trillion) is far above any realistic personal-finance figure while
 * leaving room for billions of rows to be summed without overflow.
 */
public final class MoneyLimits {

    public static final long MAX_AMOUNT_MINOR = 100_000_000_000_000L;

    private MoneyLimits() {}
}
