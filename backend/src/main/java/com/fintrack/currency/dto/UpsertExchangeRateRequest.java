package com.fintrack.currency.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public record UpsertExchangeRateRequest(
        @Pattern(regexp = "[A-Z]{3}") String currencyCode,
        @NotNull @DecimalMin(value = "0.00000001") BigDecimal rateToBase
) {}
