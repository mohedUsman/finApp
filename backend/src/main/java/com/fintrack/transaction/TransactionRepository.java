package com.fintrack.transaction;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<TransactionEntity, UUID> {

    Optional<TransactionEntity> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByCategoryId(UUID categoryId);

    boolean existsByRecurringRuleIdAndOccurrenceKey(UUID recurringRuleId, String occurrenceKey);

    @Query("SELECT t FROM TransactionEntity t WHERE t.userId = :userId " +
           "AND (:type IS NULL OR t.type = :type) " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:categoryId IS NULL OR t.categoryId = :categoryId) " +
           "AND (:from IS NULL OR t.actualDate >= :from OR t.expectedDate >= :from) " +
           "AND (:to IS NULL OR t.actualDate <= :to OR t.expectedDate <= :to)")
    Page<TransactionEntity> findByFilters(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("type") String type,
            @Param("categoryId") UUID categoryId,
            @Param("status") String status,
            Pageable pageable);
}
