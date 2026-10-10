package com.fintrack.household;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdInviteRepository extends JpaRepository<HouseholdInviteEntity, UUID> {

    Optional<HouseholdInviteEntity> findByTokenHash(String tokenHash);

    List<HouseholdInviteEntity> findByOwnerUserIdAndAcceptedAtIsNullAndRevokedAtIsNull(UUID ownerUserId);
}
