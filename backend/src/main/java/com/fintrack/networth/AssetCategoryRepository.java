package com.fintrack.networth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AssetCategoryRepository extends JpaRepository<AssetCategoryEntity, UUID> {

    List<AssetCategoryEntity> findByUserIdOrderBySortOrderAscNameAsc(UUID userId);

    Optional<AssetCategoryEntity> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndNameIgnoreCase(UUID userId, String name);
}
