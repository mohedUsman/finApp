package com.fintrack.tag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TransactionTagRepository extends JpaRepository<TransactionTagEntity, TransactionTagEntity.Key> {

    List<TransactionTagEntity> findByTransactionId(UUID transactionId);

    @Modifying
    void deleteByTransactionId(UUID transactionId);

    @Query("SELECT tt.transactionId FROM TransactionTagEntity tt WHERE tt.tagId = :tagId")
    List<UUID> findTransactionIdsByTagId(@Param("tagId") UUID tagId);

    @Query("SELECT tt.transactionId, tt.tagId FROM TransactionTagEntity tt WHERE tt.transactionId IN :txIds")
    List<Object[]> findByTransactionIdIn(@Param("txIds") List<UUID> txIds);
}
