package com.fintrack.importing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportRuleRepository extends JpaRepository<ImportRuleEntity, UUID> {

    List<ImportRuleEntity> findByUserId(UUID userId);

    Optional<ImportRuleEntity> findByUserIdAndKeywordIgnoreCase(UUID userId, String keyword);

    boolean existsByCategoryId(UUID categoryId);
}
