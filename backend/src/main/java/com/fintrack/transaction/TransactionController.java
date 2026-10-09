package com.fintrack.transaction;

import com.fintrack.security.CurrentUser;
import com.fintrack.transaction.dto.*;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping
    public ResponseEntity<Page<TransactionDto>> list(
            @CurrentUser UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(transactionService.list(userId, from, to, type, categoryId, status, pageable));
    }

    @GetMapping("/pending")
    public ResponseEntity<PendingTransactionsDto> pending(
            @CurrentUser UUID userId,
            @RequestParam(required = false, defaultValue = "7") int upcomingDays) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        return ResponseEntity.ok(transactionService.pending(userId, today, upcomingDays));
    }

    @PostMapping
    public ResponseEntity<TransactionDto> create(
            @CurrentUser UUID userId,
            @Valid @RequestBody CreateTransactionRequest req) {
        return ResponseEntity.ok(transactionService.create(userId, req));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TransactionDto> update(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTransactionRequest req) {
        return ResponseEntity.ok(transactionService.update(id, userId, req));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<TransactionDto> confirm(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody ConfirmTransactionRequest req) {
        return ResponseEntity.ok(transactionService.confirm(id, userId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @CurrentUser UUID userId,
            @PathVariable UUID id) {
        transactionService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
