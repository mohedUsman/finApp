package com.fintrack.goal;

import com.fintrack.common.BaseEntity;
import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "savings_goals")
public class SavingsGoalEntity extends BaseEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "user_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Column(name = "target_amount_minor", nullable = false)
    private Long targetAmountMinor;

    @Column(name = "saved_amount_minor", nullable = false)
    private Long savedAmountMinor = 0L;

    @Column(name = "target_date")
    private LocalDate targetDate;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getTargetAmountMinor() { return targetAmountMinor; }
    public void setTargetAmountMinor(Long targetAmountMinor) { this.targetAmountMinor = targetAmountMinor; }

    public Long getSavedAmountMinor() { return savedAmountMinor; }
    public void setSavedAmountMinor(Long savedAmountMinor) { this.savedAmountMinor = savedAmountMinor; }

    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }
}
