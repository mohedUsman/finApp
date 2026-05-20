package com.fintrack.transaction;

import com.fintrack.common.BaseEntity;
import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "transactions")
public class TransactionEntity extends BaseEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "user_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "type", length = 20, nullable = false, updatable = false)
    private String type;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "category_id", columnDefinition = "BINARY(16)", nullable = false)
    private UUID categoryId;

    @Column(name = "currency_code", columnDefinition = "CHAR(3)", nullable = false)
    private String currencyCode = "INR";

    @Column(name = "status", length = 20, nullable = false)
    private String status;

    @Column(name = "expected_amount_minor")
    private Long expectedAmountMinor;

    @Column(name = "expected_date")
    private LocalDate expectedDate;

    @Column(name = "actual_amount_minor")
    private Long actualAmountMinor;

    @Column(name = "actual_date")
    private LocalDate actualDate;

    @Column(name = "note", length = 500)
    private String note;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "recurring_rule_id", columnDefinition = "BINARY(16)")
    private UUID recurringRuleId;

    @Column(name = "occurrence_key", length = 120)
    private String occurrenceKey;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public UUID getCategoryId() { return categoryId; }
    public void setCategoryId(UUID categoryId) { this.categoryId = categoryId; }

    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getExpectedAmountMinor() { return expectedAmountMinor; }
    public void setExpectedAmountMinor(Long expectedAmountMinor) { this.expectedAmountMinor = expectedAmountMinor; }

    public LocalDate getExpectedDate() { return expectedDate; }
    public void setExpectedDate(LocalDate expectedDate) { this.expectedDate = expectedDate; }

    public Long getActualAmountMinor() { return actualAmountMinor; }
    public void setActualAmountMinor(Long actualAmountMinor) { this.actualAmountMinor = actualAmountMinor; }

    public LocalDate getActualDate() { return actualDate; }
    public void setActualDate(LocalDate actualDate) { this.actualDate = actualDate; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public UUID getRecurringRuleId() { return recurringRuleId; }
    public void setRecurringRuleId(UUID recurringRuleId) { this.recurringRuleId = recurringRuleId; }

    public String getOccurrenceKey() { return occurrenceKey; }
    public void setOccurrenceKey(String occurrenceKey) { this.occurrenceKey = occurrenceKey; }

    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant confirmedAt) { this.confirmedAt = confirmedAt; }
}
