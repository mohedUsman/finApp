package com.fintrack.transaction;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
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

    /**
     * Global search across all months — note text plus optional amount range,
     * matched against whichever amount column is populated (expected or actual).
     */
    @Query("SELECT t FROM TransactionEntity t WHERE t.userId = :userId " +
           "AND (:type IS NULL OR t.type = :type) " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:categoryId IS NULL OR t.categoryId = :categoryId) " +
           "AND (:from IS NULL OR t.actualDate >= :from OR t.expectedDate >= :from) " +
           "AND (:to IS NULL OR t.actualDate <= :to OR t.expectedDate <= :to) " +
           "AND (:note IS NULL OR LOWER(t.note) LIKE LOWER(CONCAT('%', :note, '%'))) " +
           "AND (:minAmount IS NULL OR COALESCE(t.actualAmountMinor, t.expectedAmountMinor, 0) >= :minAmount) " +
           "AND (:maxAmount IS NULL OR COALESCE(t.actualAmountMinor, t.expectedAmountMinor, 0) <= :maxAmount)")
    Page<TransactionEntity> search(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("type") String type,
            @Param("categoryId") UUID categoryId,
            @Param("status") String status,
            @Param("note") String note,
            @Param("minAmount") Long minAmount,
            @Param("maxAmount") Long maxAmount,
            Pageable pageable);

    /**
     * Planned transactions whose date has passed but were never confirmed —
     * the user's "did I actually pay this?" list.
     *
     * <p>Recurring generation inserts EXPECTED rows silently. Unconfirmed ones
     * sit in the variance figures indefinitely, so without a way to see them
     * the reports drift further from reality every month.
     *
     * <p>Served by {@code ix_transactions_user_expected (user_id, expected_date)}.
     */
    @Query("SELECT t FROM TransactionEntity t WHERE t.userId = :userId " +
           "AND t.status = 'EXPECTED' AND t.expectedDate < :asOf " +
           "ORDER BY t.expectedDate ASC")
    List<TransactionEntity> findOverdue(@Param("userId") UUID userId, @Param("asOf") LocalDate asOf);

    /** Planned transactions coming due in the next few days. */
    @Query("SELECT t FROM TransactionEntity t WHERE t.userId = :userId " +
           "AND t.status = 'EXPECTED' AND t.expectedDate BETWEEN :from AND :to " +
           "ORDER BY t.expectedDate ASC")
    List<TransactionEntity> findUpcoming(@Param("userId") UUID userId,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);
}
