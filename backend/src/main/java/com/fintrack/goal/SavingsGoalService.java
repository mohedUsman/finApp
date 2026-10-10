package com.fintrack.goal;

import com.fintrack.common.exception.BadRequestException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.goal.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SavingsGoalService {

    private final SavingsGoalRepository goals;

    public SavingsGoalService(SavingsGoalRepository goals) {
        this.goals = goals;
    }

    public List<SavingsGoalDto> list(UUID userId) {
        return goals.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public SavingsGoalDto create(UUID userId, CreateSavingsGoalRequest req) {
        SavingsGoalEntity g = new SavingsGoalEntity();
        g.setId(UUID.randomUUID());
        g.setUserId(userId);
        g.setName(req.name().trim());
        g.setTargetAmountMinor(req.targetAmountMinor());
        g.setSavedAmountMinor(req.savedAmountMinor() != null ? req.savedAmountMinor() : 0L);
        g.setTargetDate(req.targetDate());
        goals.save(g);
        return toDto(g);
    }

    @Transactional
    public SavingsGoalDto update(UUID id, UUID userId, UpdateSavingsGoalRequest req) {
        SavingsGoalEntity g = findOwned(id, userId);

        if (req.name() != null && !req.name().isBlank()) g.setName(req.name().trim());
        if (req.targetAmountMinor() != null) g.setTargetAmountMinor(req.targetAmountMinor());
        if (req.savedAmountMinor() != null) g.setSavedAmountMinor(req.savedAmountMinor());
        if (Boolean.TRUE.equals(req.clearTargetDate())) {
            g.setTargetDate(null);
        } else if (req.targetDate() != null) {
            g.setTargetDate(req.targetDate());
        }
        return toDto(g);
    }

    @Transactional
    public SavingsGoalDto contribute(UUID id, UUID userId, ContributeRequest req) {
        SavingsGoalEntity g = findOwned(id, userId);
        long newSaved = g.getSavedAmountMinor() + req.amountMinor();
        if (newSaved < 0) {
            throw new BadRequestException("INSUFFICIENT_SAVED", "Cannot withdraw more than the saved amount");
        }
        g.setSavedAmountMinor(newSaved);
        return toDto(g);
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        goals.delete(findOwned(id, userId));
    }

    private SavingsGoalEntity findOwned(UUID id, UUID userId) {
        return goals.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Savings goal not found"));
    }

    private SavingsGoalDto toDto(SavingsGoalEntity g) {
        return new SavingsGoalDto(g.getId(), g.getName(), g.getTargetAmountMinor(),
                g.getSavedAmountMinor(), g.getTargetDate());
    }
}
