package com.fintrack.recurring;

import com.fintrack.recurring.dto.CreateRecurringRuleRequest;
import com.fintrack.recurring.dto.GenerateResult;
import com.fintrack.recurring.dto.RecurringRuleDto;
import com.fintrack.recurring.dto.UpdateRecurringRuleRequest;
import com.fintrack.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class RecurringController {

    private final RecurringRuleService recurringRuleService;

    public RecurringController(RecurringRuleService recurringRuleService) {
        this.recurringRuleService = recurringRuleService;
    }

    @GetMapping("/recurring-rules")
    public ResponseEntity<List<RecurringRuleDto>> list(@CurrentUser UUID userId) {
        return ResponseEntity.ok(recurringRuleService.list(userId));
    }

    @PostMapping("/recurring-rules")
    public ResponseEntity<RecurringRuleDto> create(
            @CurrentUser UUID userId,
            @Valid @RequestBody CreateRecurringRuleRequest req) {
        return ResponseEntity.ok(recurringRuleService.create(userId, req));
    }

    @PatchMapping("/recurring-rules/{id}")
    public ResponseEntity<RecurringRuleDto> update(
            @CurrentUser UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRecurringRuleRequest req) {
        return ResponseEntity.ok(recurringRuleService.update(id, userId, req));
    }

    @DeleteMapping("/recurring-rules/{id}")
    public ResponseEntity<Void> delete(
            @CurrentUser UUID userId,
            @PathVariable UUID id) {
        recurringRuleService.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recurring/generate")
    public ResponseEntity<GenerateResult> generate(
            @CurrentUser UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate throughDate) {
        return ResponseEntity.ok(recurringRuleService.generate(userId, throughDate));
    }
}
