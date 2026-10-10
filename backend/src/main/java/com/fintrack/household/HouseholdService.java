package com.fintrack.household;

import com.fintrack.common.exception.BadRequestException;
import com.fintrack.common.exception.ForbiddenException;
import com.fintrack.common.exception.NotFoundException;
import com.fintrack.household.dto.HouseholdInviteDto;
import com.fintrack.household.dto.HouseholdMemberDto;
import com.fintrack.household.dto.HouseholdView;
import com.fintrack.household.dto.InviteMemberRequest;
import com.fintrack.user.UserEntity;
import com.fintrack.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Household sharing keeps user_id on every domain row as the owning user, and
 * widens who may act as that user rather than re-keying the schema. A member's
 * requests resolve to their owner's data scope; a VIEWER additionally cannot
 * mutate anything.
 *
 * As with password reset, there is no email provider wired in — the invite link
 * token is logged at INFO instead of sent.
 */
@Service
public class HouseholdService {

    private static final Logger log = LoggerFactory.getLogger(HouseholdService.class);
    private static final long INVITE_TTL_DAYS = 7;

    private final HouseholdMemberRepository members;
    private final HouseholdInviteRepository invites;
    private final UserRepository users;
    private final SecureRandom random = new SecureRandom();

    public HouseholdService(HouseholdMemberRepository members, HouseholdInviteRepository invites,
                            UserRepository users) {
        this.members = members;
        this.invites = invites;
        this.users = users;
    }

    /**
     * The user whose data this request operates on: the caller's household
     * owner if they've joined one, otherwise the caller themselves.
     */
    public UUID dataOwnerFor(UUID userId) {
        return members.findByMemberUserId(userId)
                .map(HouseholdMemberEntity::getOwnerUserId)
                .orElse(userId);
    }

    /** Throws if the caller joined a household as a read-only VIEWER. */
    public void requireWriteAccess(UUID userId) {
        members.findByMemberUserId(userId).ifPresent(m -> {
            if ("VIEWER".equals(m.getRole())) {
                throw new ForbiddenException("You have view-only access to this household");
            }
        });
    }

    public HouseholdView view(UUID userId) {
        Optional<HouseholdMemberEntity> membership = members.findByMemberUserId(userId);
        if (membership.isPresent()) {
            HouseholdMemberEntity m = membership.get();
            UserEntity owner = users.findById(m.getOwnerUserId())
                    .orElseThrow(() -> new NotFoundException("Household owner not found"));
            return new HouseholdView(false, m.getRole(), owner.getEmail(), List.of(), List.of());
        }
        return new HouseholdView(true, "OWNER", null, listMembers(userId), listInvites(userId));
    }

    private List<HouseholdMemberDto> listMembers(UUID ownerUserId) {
        List<HouseholdMemberDto> out = new ArrayList<>();
        for (HouseholdMemberEntity m : members.findByOwnerUserId(ownerUserId)) {
            String email = users.findById(m.getMemberUserId()).map(UserEntity::getEmail).orElse("(unknown)");
            out.add(new HouseholdMemberDto(m.getId(), email, m.getRole(), m.getCreatedAt()));
        }
        return out;
    }

    private List<HouseholdInviteDto> listInvites(UUID ownerUserId) {
        return invites.findByOwnerUserIdAndAcceptedAtIsNullAndRevokedAtIsNull(ownerUserId).stream()
                .map(i -> new HouseholdInviteDto(i.getId(), i.getEmail(), i.getRole(), i.getExpiresAt()))
                .toList();
    }

    @Transactional
    public HouseholdInviteDto invite(UUID ownerUserId, InviteMemberRequest req) {
        if (members.findByMemberUserId(ownerUserId).isPresent()) {
            throw new BadRequestException("ALREADY_MEMBER",
                    "You've joined someone else's household — leave it before inviting others");
        }
        String email = req.email().trim().toLowerCase();
        UserEntity owner = users.findById(ownerUserId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (email.equals(owner.getEmail())) {
            throw new BadRequestException("SELF_INVITE", "You can't invite yourself");
        }

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        HouseholdInviteEntity invite = new HouseholdInviteEntity();
        invite.setId(UUID.randomUUID());
        invite.setOwnerUserId(ownerUserId);
        invite.setEmail(email);
        invite.setRole(req.role());
        invite.setTokenHash(sha256Hex(rawToken));
        invite.setExpiresAt(Instant.now().plus(INVITE_TTL_DAYS, ChronoUnit.DAYS));
        invites.save(invite);

        log.info("Household invite for {} from {} (valid {} days). Invite token: {}",
                email, owner.getEmail(), INVITE_TTL_DAYS, rawToken);

        return new HouseholdInviteDto(invite.getId(), invite.getEmail(), invite.getRole(), invite.getExpiresAt());
    }

    @Transactional
    public void acceptInvite(UUID userId, String rawToken) {
        HouseholdInviteEntity invite = invites.findByTokenHash(sha256Hex(rawToken))
                .orElseThrow(() -> new BadRequestException("INVALID_INVITE", "Invalid or expired invite"));
        if (invite.getAcceptedAt() != null || invite.getRevokedAt() != null
                || invite.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("INVALID_INVITE", "Invalid or expired invite");
        }

        UserEntity user = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        if (!user.getEmail().equals(invite.getEmail())) {
            throw new BadRequestException("INVALID_INVITE", "This invite was sent to a different email");
        }
        if (invite.getOwnerUserId().equals(userId)) {
            throw new BadRequestException("INVALID_INVITE", "You can't join your own household");
        }
        if (members.findByMemberUserId(userId).isPresent()) {
            throw new BadRequestException("ALREADY_MEMBER", "You've already joined a household");
        }
        // An owner with members of their own would otherwise create a chain —
        // dataOwnerFor() resolves one hop only, so nested households are refused.
        if (!members.findByOwnerUserId(userId).isEmpty()) {
            throw new BadRequestException("OWNS_HOUSEHOLD",
                    "Remove your own household members before joining another household");
        }

        HouseholdMemberEntity member = new HouseholdMemberEntity();
        member.setId(UUID.randomUUID());
        member.setOwnerUserId(invite.getOwnerUserId());
        member.setMemberUserId(userId);
        member.setRole(invite.getRole());
        members.save(member);

        invite.setAcceptedAt(Instant.now());
    }

    @Transactional
    public void revokeInvite(UUID ownerUserId, UUID inviteId) {
        HouseholdInviteEntity invite = invites.findById(inviteId)
                .filter(i -> i.getOwnerUserId().equals(ownerUserId))
                .orElseThrow(() -> new NotFoundException("Invite not found"));
        invite.setRevokedAt(Instant.now());
    }

    @Transactional
    public void removeMember(UUID ownerUserId, UUID memberId) {
        HouseholdMemberEntity member = members.findById(memberId)
                .filter(m -> m.getOwnerUserId().equals(ownerUserId))
                .orElseThrow(() -> new NotFoundException("Member not found"));
        members.delete(member);
    }

    @Transactional
    public void leave(UUID userId) {
        HouseholdMemberEntity member = members.findByMemberUserId(userId)
                .orElseThrow(() -> new NotFoundException("You haven't joined a household"));
        members.delete(member);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
