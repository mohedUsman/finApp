package com.fintrack.category.dto;

import com.fintrack.transaction.dto.MoneyLimits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UpdateCategoryRequest(
        @Size(max = 80) String name,
        UUID parentId,
        Boolean isActive,
        Integer sortOrder,
        @Min(0) @Max(MoneyLimits.MAX_AMOUNT_MINOR) Long monthlyBudgetMinor,
        Boolean clearBudget
) {}
