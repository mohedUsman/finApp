package com.fintrack.networth;

import com.fintrack.common.BaseEntity;
import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "net_worth_snapshots")
public class NetWorthSnapshotEntity extends BaseEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "user_id", columnDefinition = "BINARY(16)", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "balances", columnDefinition = "JSON", nullable = false)
    private String balances;

    @Column(name = "note", length = 500)
    private String note;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public LocalDate getSnapshotDate() { return snapshotDate; }
    public void setSnapshotDate(LocalDate snapshotDate) { this.snapshotDate = snapshotDate; }

    public String getBalances() { return balances; }
    public void setBalances(String balances) { this.balances = balances; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
