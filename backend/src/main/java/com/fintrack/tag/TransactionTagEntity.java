package com.fintrack.tag;

import com.fintrack.common.UuidBinaryConverter;
import jakarta.persistence.*;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "transaction_tags")
@IdClass(TransactionTagEntity.Key.class)
public class TransactionTagEntity {

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "transaction_id", columnDefinition = "BINARY(16)", nullable = false)
    private UUID transactionId;

    @Id
    @Convert(converter = UuidBinaryConverter.class)
    @Column(name = "tag_id", columnDefinition = "BINARY(16)", nullable = false)
    private UUID tagId;

    public TransactionTagEntity() {}

    public TransactionTagEntity(UUID transactionId, UUID tagId) {
        this.transactionId = transactionId;
        this.tagId = tagId;
    }

    public UUID getTransactionId() { return transactionId; }
    public void setTransactionId(UUID transactionId) { this.transactionId = transactionId; }

    public UUID getTagId() { return tagId; }
    public void setTagId(UUID tagId) { this.tagId = tagId; }

    public static class Key implements Serializable {
        private UUID transactionId;
        private UUID tagId;

        public Key() {}
        public Key(UUID transactionId, UUID tagId) {
            this.transactionId = transactionId;
            this.tagId = tagId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(transactionId, key.transactionId) && Objects.equals(tagId, key.tagId);
        }

        @Override
        public int hashCode() { return Objects.hash(transactionId, tagId); }
    }
}
