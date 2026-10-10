package com.fintrack.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetTokenEntity, UUID> {

    Optional<PasswordResetTokenEntity> findByTokenHash(String tokenHash);

    /** Invalidates any still-live reset requests before issuing a new one, so only the latest link works. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PasswordResetTokenEntity p SET p.usedAt = :now " +
            "WHERE p.userId = :userId AND p.usedAt IS NULL")
    int invalidateAllForUser(@Param("userId") UUID userId, @Param("now") Instant now);
}
