package com.fintrack.currency;

import com.fintrack.common.exception.BadRequestException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.currency.dto.ExchangeRateDto;
import com.fintrack.currency.dto.UpsertExchangeRateRequest;
import com.fintrack.user.UserEntity;
import com.fintrack.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * There is no external FX feed in this app — rates are entered manually by
 * the user (a currency relative to their own base_currency_code) and reused
 * by reporting to convert non-base transactions before summing.
 */
@Service
public class ExchangeRateService {

    private final ExchangeRateRepository rates;
    private final UserRepository users;

    public ExchangeRateService(ExchangeRateRepository rates, UserRepository users) {
        this.rates = rates;
        this.users = users;
    }

    public List<ExchangeRateDto> list(UUID userId) {
        return rates.findByUserId(userId).stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public ExchangeRateDto upsert(UUID userId, UpsertExchangeRateRequest req) {
        UserEntity user = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        String code = req.currencyCode().toUpperCase();
        if (code.equals(user.getBaseCurrencyCode())) {
            throw new BadRequestException("BASE_CURRENCY", "Cannot set a rate for your own base currency");
        }

        ExchangeRateEntity entity = rates.findByUserIdAndCurrencyCode(userId, code)
                .orElseGet(() -> {
                    ExchangeRateEntity e = new ExchangeRateEntity();
                    e.setId(UUID.randomUUID());
                    e.setUserId(userId);
                    e.setCurrencyCode(code);
                    return e;
                });
        entity.setRateToBase(req.rateToBase());
        rates.save(entity);
        return toDto(entity);
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        ExchangeRateEntity entity = rates.findById(id)
                .filter(e -> e.getUserId().equals(userId))
                .orElseThrow(() -> new NotFoundException("Exchange rate not found"));
        rates.delete(entity);
    }

    private ExchangeRateDto toDto(ExchangeRateEntity e) {
        return new ExchangeRateDto(e.getId(), e.getCurrencyCode(), e.getRateToBase(), e.getUpdatedAt());
    }
}
