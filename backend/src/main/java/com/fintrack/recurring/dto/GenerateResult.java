package com.fintrack.recurring.dto;

public record GenerateResult(int generatedCount, int skippedExistingCount, int advancedRuleCount) {}
