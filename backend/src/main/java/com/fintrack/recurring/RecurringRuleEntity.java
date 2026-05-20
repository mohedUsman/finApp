package com.fintrack.recurring;

import com.fintrack.common.BaseEntity;
import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "recurring_rules")
public class RecurringRuleEntity extends BaseEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "user_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "type", length = 20, nullable = false)
    private String type;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "category_id", columnDefinition = "BINARY(16)", nullable = false)
    private UUID categoryId;

    @Column(name = "currency_code", columnDefinition = "CHAR(3)", nullable = false)
    private String currencyCode = "INR";

    @Column(name = "default_expected_amount_minor", nullable = false)
    private Long defaultExpectedAmountMinor;

    @Column(name = "note_template", length = 500)
    private String noteTemplate;

    @Column(name = "schedule_type", length = 20, nullable = false)
    private String scheduleType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "schedule_config", columnDefinition = "JSON", nullable = false)
    private String scheduleConfig;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "next_run_date", nullable = false)
    private LocalDate nextRunDate;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

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

    public Long getDefaultExpectedAmountMinor() { return defaultExpectedAmountMinor; }
    public void setDefaultExpectedAmountMinor(Long defaultExpectedAmountMinor) { this.defaultExpectedAmountMinor = defaultExpectedAmountMinor; }

    public String getNoteTemplate() { return noteTemplate; }
    public void setNoteTemplate(String noteTemplate) { this.noteTemplate = noteTemplate; }

    public String getScheduleType() { return scheduleType; }
    public void setScheduleType(String scheduleType) { this.scheduleType = scheduleType; }

    public String getScheduleConfig() { return scheduleConfig; }
    public void setScheduleConfig(String scheduleConfig) { this.scheduleConfig = scheduleConfig; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public LocalDate getNextRunDate() { return nextRunDate; }
    public void setNextRunDate(LocalDate nextRunDate) { this.nextRunDate = nextRunDate; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean isActive) { this.isActive = isActive; }
}
