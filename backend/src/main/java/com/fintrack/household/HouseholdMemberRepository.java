package com.fintrack.household;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HouseholdMemberRepository extends JpaRepository<HouseholdMemberEntity, UUID> {

    Optional<HouseholdMemberEntity> findByMemberUserId(UUID memberUserId);

    List<HouseholdMemberEntity> findByOwnerUserId(UUID ownerUserId);
}
