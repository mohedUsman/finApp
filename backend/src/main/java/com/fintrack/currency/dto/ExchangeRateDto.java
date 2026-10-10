package com.fintrack.currency.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExchangeRateDto(UUID id, String currencyCode, BigDecimal rateToBase, Instant updatedAt) {}
