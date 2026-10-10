package com.fintrack.household;

import com.fintrack.common.BaseEntity;
import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "household_members")
public class HouseholdMemberEntity extends BaseEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "owner_user_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID ownerUserId;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "member_user_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID memberUserId;

    @Column(name = "role", nullable = false, length = 20)
    private String role;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(UUID ownerUserId) { this.ownerUserId = ownerUserId; }

    public UUID getMemberUserId() { return memberUserId; }
    public void setMemberUserId(UUID memberUserId) { this.memberUserId = memberUserId; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}
