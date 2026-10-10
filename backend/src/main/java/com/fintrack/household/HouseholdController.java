package com.fintrack.household;

import com.fintrack.household.dto.AcceptInviteRequest;
import com.fintrack.household.dto.HouseholdInviteDto;
import com.fintrack.household.dto.HouseholdView;
import com.fintrack.household.dto.InviteMemberRequest;
import com.fintrack.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/household")
public class HouseholdController {

    private final HouseholdService service;

    public HouseholdController(HouseholdService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<HouseholdView> view(@CurrentUser UUID userId) {
        return ResponseEntity.ok(service.view(userId));
    }

    @PostMapping("/invites")
    public ResponseEntity<HouseholdInviteDto> invite(@CurrentUser UUID userId,
                                                     @Valid @RequestBody InviteMemberRequest req) {
        return ResponseEntity.ok(service.invite(userId, req));
    }

    @PostMapping("/invites/accept")
    public ResponseEntity<Void> accept(@CurrentUser UUID userId,
                                       @Valid @RequestBody AcceptInviteRequest req) {
        service.acceptInvite(userId, req.token());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/invites/{id}")
    public ResponseEntity<Void> revokeInvite(@CurrentUser UUID userId, @PathVariable UUID id) {
        service.revokeInvite(userId, id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/members/{id}")
    public ResponseEntity<Void> removeMember(@CurrentUser UUID userId, @PathVariable UUID id) {
        service.removeMember(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/leave")
    public ResponseEntity<Void> leave(@CurrentUser UUID userId) {
        service.leave(userId);
        return ResponseEntity.noContent().build();
    }
}
