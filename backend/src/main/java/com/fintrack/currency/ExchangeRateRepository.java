package com.fintrack.currency;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExchangeRateRepository extends JpaRepository<ExchangeRateEntity, UUID> {
    List<ExchangeRateEntity> findByUserId(UUID userId);
    Optional<ExchangeRateEntity> findByUserIdAndCurrencyCode(UUID userId, String currencyCode);
}
