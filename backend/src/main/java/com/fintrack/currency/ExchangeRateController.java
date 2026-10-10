package com.fintrack.currency;

import com.fintrack.currency.dto.ExchangeRateDto;
import com.fintrack.currency.dto.UpsertExchangeRateRequest;
import com.fintrack.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/exchange-rates")
public class ExchangeRateController {

    private final ExchangeRateService service;

    public ExchangeRateController(ExchangeRateService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ExchangeRateDto>> list(@CurrentUser UUID userId) {
        return ResponseEntity.ok(service.list(userId));
    }

    @PutMapping
    public ResponseEntity<ExchangeRateDto> upsert(@CurrentUser UUID userId,
                                                   @Valid @RequestBody UpsertExchangeRateRequest req) {
        return ResponseEntity.ok(service.upsert(userId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@CurrentUser UUID userId, @PathVariable UUID id) {
        service.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
