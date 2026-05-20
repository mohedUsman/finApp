package com.fintrack.networth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NetWorthSnapshotRepository extends JpaRepository<NetWorthSnapshotEntity, UUID> {

    List<NetWorthSnapshotEntity> findByUserIdOrderBySnapshotDateDesc(UUID userId);

    Optional<NetWorthSnapshotEntity> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndSnapshotDate(UUID userId, LocalDate snapshotDate);

    boolean existsByUserIdAndSnapshotDateAndIdNot(UUID userId, LocalDate snapshotDate, UUID excludeId);
}
