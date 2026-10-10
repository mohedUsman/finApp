package com.fintrack.goal;

import com.fintrack.goal.dto.*;
import com.fintrack.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/savings-goals")
public class SavingsGoalController {

    private final SavingsGoalService savingsGoalService;

    public SavingsGoalController(SavingsGoalService savingsGoalService) {
        this.savingsGoalService = savingsGoalService;
    }

    @GetMapping
    public ResponseEntity<List<SavingsGoalDto>> list(@CurrentUser UUID userId) {
        return ResponseEntity.ok(savingsGoalService.list(userId));
    }

    @PostMapping
    public ResponseEntity<SavingsGoalDto> create(
            @CurrentUser UUID userId,
            @Valid @RequestBody CreateSavingsGoalRequest req) {
        return ResponseEntity.ok(savingsGoalService.create(userId, req));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<SavingsGoalDto> update(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSavingsGoalRequest req) {
        return ResponseEntity.ok(savingsGoalService.update(id, userId, req));
    }

    @PostMapping("/{id}/contribute")
    public ResponseEntity<SavingsGoalDto> contribute(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody ContributeRequest req) {
        return ResponseEntity.ok(savingsGoalService.contribute(id, userId, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @CurrentUser UUID userId,
            @PathVariable UUID id) {
        savingsGoalService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
