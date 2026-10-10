package com.fintrack.goal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoalEntity, UUID> {

    List<SavingsGoalEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<SavingsGoalEntity> findByIdAndUserId(UUID id, UUID userId);
}
