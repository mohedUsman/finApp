package com.fintrack.recurring;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RecurringRuleRepository extends JpaRepository<RecurringRuleEntity, UUID> {

    List<RecurringRuleEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<RecurringRuleEntity> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RecurringRuleEntity r WHERE r.userId = :userId AND r.isActive = TRUE AND r.nextRunDate <= :today")
    List<RecurringRuleEntity> findDueRulesWithLock(@Param("userId") UUID userId, @Param("today") LocalDate today);

    boolean existsByCategoryId(UUID categoryId);
}
