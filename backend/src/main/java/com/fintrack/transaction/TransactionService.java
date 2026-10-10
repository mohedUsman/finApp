package com.fintrack.transaction;

import com.fintrack.category.CategoryEntity;
import com.fintrack.category.CategoryRepository;
import com.fintrack.common.exception.BadRequestException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.transaction.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TransactionService {

    private final TransactionRepository transactions;
    private final CategoryRepository categories;

    public TransactionService(TransactionRepository transactions, CategoryRepository categories) {
        this.transactions = transactions;
        this.categories = categories;
    }

    public Page<TransactionDto> list(UUID userId, LocalDate from, LocalDate to,
                                      String type, UUID categoryId, String status, Pageable pageable) {
        return transactions.findByFilters(userId, from, to, type, categoryId, status, pageable)
                .map(t -> toDto(t, resolveCategoryName(t.getCategoryId())));
    }

    /** Global search, not scoped to a single month: note text plus amount range. */
    public Page<TransactionDto> search(UUID userId, LocalDate from, LocalDate to, String type,
                                        UUID categoryId, String status, String note,
                                        Long minAmount, Long maxAmount, Pageable pageable) {
        return transactions.search(userId, from, to, type, categoryId, status, note, minAmount, maxAmount, pageable)
                .map(t -> toDto(t, resolveCategoryName(t.getCategoryId())));
    }

    /**
     * The user's action list: planned transactions that are overdue (date
     * passed, never confirmed) and those coming due shortly.
     */
    public PendingTransactionsDto pending(UUID userId, LocalDate today, int upcomingDays) {
        List<TransactionEntity> overdue = transactions.findOverdue(userId, today);
        List<TransactionEntity> upcoming =
                transactions.findUpcoming(userId, today, today.plusDays(upcomingDays));

        // Resolve names from one query rather than per row.
        Map<UUID, String> names = categories.findByUserId(userId).stream()
                .collect(Collectors.toMap(CategoryEntity::getId, CategoryEntity::getName));

        return new PendingTransactionsDto(
                overdue.stream().map(t -> toDto(t, names.getOrDefault(t.getCategoryId(), ""))).toList(),
                upcoming.stream().map(t -> toDto(t, names.getOrDefault(t.getCategoryId(), ""))).toList());
    }

    @Transactional
    public TransactionDto create(UUID userId, CreateTransactionRequest req) {
        CategoryEntity cat = requireCategory(userId, req.categoryId(), req.type());
        validateStatusFields(req.status(), req.expectedAmountMinor(), req.expectedDate(),
                req.actualAmountMinor(), req.actualDate());

        TransactionEntity t = new TransactionEntity();
        t.setId(UUID.randomUUID());
        t.setUserId(userId);
        t.setType(req.type());
        t.setCategoryId(req.categoryId());
        t.setCurrencyCode("INR");
        t.setStatus(req.status());
        t.setExpectedAmountMinor(req.expectedAmountMinor());
        t.setExpectedDate(req.expectedDate());
        t.setActualAmountMinor(req.actualAmountMinor());
        t.setActualDate(req.actualDate());
        t.setNote(req.note());
        if ("ACTUAL".equals(req.status())) {
            t.setConfirmedAt(Instant.now());
        }
        transactions.save(t);
        return toDto(t, cat.getName());
    }

    @Transactional
    public TransactionDto update(UUID id, UUID userId, UpdateTransactionRequest req) {
        TransactionEntity t = findOwned(id, userId);

        if (req.categoryId() != null) {
            requireCategory(userId, req.categoryId(), t.getType());
            t.setCategoryId(req.categoryId());
        }
        if (req.status() != null) {
            t.setStatus(req.status());
            if ("ACTUAL".equals(req.status()) && t.getConfirmedAt() == null) {
                t.setConfirmedAt(Instant.now());
            }
        }
        if (req.expectedAmountMinor() != null) t.setExpectedAmountMinor(req.expectedAmountMinor());
        if (req.expectedDate() != null) t.setExpectedDate(req.expectedDate());
        if (req.actualAmountMinor() != null) t.setActualAmountMinor(req.actualAmountMinor());
        if (req.actualDate() != null) t.setActualDate(req.actualDate());
        if (req.note() != null) t.setNote(req.note());

        // Validate the merged state, not the request: a PATCH that only flips
        // status to ACTUAL must still leave the row with an actual amount+date,
        // otherwise it becomes invisible to the cash lens and unconfirmable.
        validateStatusFields(t.getStatus(), t.getExpectedAmountMinor(), t.getExpectedDate(),
                t.getActualAmountMinor(), t.getActualDate());

        return toDto(t, resolveCategoryName(t.getCategoryId()));
    }

    @Transactional
    public TransactionDto confirm(UUID id, UUID userId, ConfirmTransactionRequest req) {
        TransactionEntity t = findOwned(id, userId);
        if (!"EXPECTED".equals(t.getStatus())) {
            throw new BadRequestException("NOT_EXPECTED", "Only EXPECTED transactions can be confirmed");
        }
        t.setStatus("ACTUAL");
        t.setActualAmountMinor(req.actualAmountMinor());
        t.setActualDate(req.actualDate());
        if (req.note() != null) t.setNote(req.note());
        t.setConfirmedAt(Instant.now());
        return toDto(t, resolveCategoryName(t.getCategoryId()));
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        transactions.delete(findOwned(id, userId));
    }

    private CategoryEntity requireCategory(UUID userId, UUID categoryId, String type) {
        CategoryEntity cat = categories.findByIdAndUserId(categoryId, userId)
                .orElseThrow(() -> new BadRequestException("CATEGORY_NOT_FOUND", "Category not found"));
        if (!cat.getType().equals(type)) {
            throw new BadRequestException("CATEGORY_TYPE_MISMATCH",
                    "Category type must match transaction type");
        }
        if (!cat.isActive()) {
            throw new BadRequestException("CATEGORY_INACTIVE", "Category is inactive");
        }
        return cat;
    }

    private void validateStatusFields(String status, Long expectedAmt, LocalDate expectedDate,
                                       Long actualAmt, LocalDate actualDate) {
        if ("EXPECTED".equals(status)) {
            if (expectedAmt == null) throw new BadRequestException("MISSING_FIELD",
                    "expectedAmountMinor is required for EXPECTED transactions");
            if (expectedDate == null) throw new BadRequestException("MISSING_FIELD",
                    "expectedDate is required for EXPECTED transactions");
        } else {
            if (actualAmt == null) throw new BadRequestException("MISSING_FIELD",
                    "actualAmountMinor is required for ACTUAL transactions");
            if (actualDate == null) throw new BadRequestException("MISSING_FIELD",
                    "actualDate is required for ACTUAL transactions");
        }
    }

    private TransactionEntity findOwned(UUID id, UUID userId) {
        return transactions.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Transaction not found"));
    }

    private String resolveCategoryName(UUID categoryId) {
        return categories.findById(categoryId).map(CategoryEntity::getName).orElse("");
    }

    private TransactionDto toDto(TransactionEntity t, String categoryName) {
        return new TransactionDto(t.getId(), t.getType(), t.getCategoryId(), categoryName,
                t.getCurrencyCode(), t.getStatus(), t.getExpectedAmountMinor(), t.getExpectedDate(),
                t.getActualAmountMinor(), t.getActualDate(), t.getNote(), t.getRecurringRuleId(),
                t.getOccurrenceKey(), t.getConfirmedAt(), t.getCreatedAt(), t.getUpdatedAt());
    }
}
