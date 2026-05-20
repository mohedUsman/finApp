package com.fintrack.category;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<CategoryEntity, UUID> {

    @Query("SELECT c FROM CategoryEntity c WHERE c.userId = :userId " +
           "AND (:type IS NULL OR c.type = :type) " +
           "AND (:includeInactive = TRUE OR c.isActive = TRUE) " +
           "ORDER BY c.sortOrder ASC, c.name ASC")
    List<CategoryEntity> findByFilters(@Param("userId") UUID userId,
                                        @Param("type") String type,
                                        @Param("includeInactive") boolean includeInactive);

    Optional<CategoryEntity> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByParentIdAndUserId(UUID parentId, UUID userId);

    boolean existsByUserIdAndTypeAndParentIdIsNullAndNameIgnoreCase(UUID userId, String type, String name);

    boolean existsByUserIdAndTypeAndParentIdAndNameIgnoreCase(UUID userId, String type, UUID parentId, String name);

    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN TRUE ELSE FALSE END FROM CategoryEntity c " +
           "WHERE c.userId = :userId AND c.type = :type AND c.parentId IS NULL " +
           "AND LOWER(c.name) = LOWER(:name) AND c.id <> :excludeId")
    boolean existsSiblingWithNullParentExcluding(@Param("userId") UUID userId,
                                                  @Param("type") String type,
                                                  @Param("name") String name,
                                                  @Param("excludeId") UUID excludeId);

    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN TRUE ELSE FALSE END FROM CategoryEntity c " +
           "WHERE c.userId = :userId AND c.type = :type AND c.parentId = :parentId " +
           "AND LOWER(c.name) = LOWER(:name) AND c.id <> :excludeId")
    boolean existsSiblingWithParentExcluding(@Param("userId") UUID userId,
                                              @Param("type") String type,
                                              @Param("parentId") UUID parentId,
                                              @Param("name") String name,
                                              @Param("excludeId") UUID excludeId);
}
