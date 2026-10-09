package com.fintrack.transaction.dto;

import java.util.List;

public record PendingTransactionsDto(
        List<TransactionDto> overdue,
        List<TransactionDto> upcoming) {
}
