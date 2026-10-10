package com.fintrack.auth;

import com.fintrack.common.exception.BadRequestException;
import com.fintrack.user.UserEntity;
import com.fintrack.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;

/**
 * There is no email provider wired into this app (see CLAUDE.md — out of
 * scope for v1), so a requested reset link is logged at INFO instead of sent.
 * That keeps the token flow itself — generation, hashing, single-use,
 * expiry — real and testable without taking on SMTP/provider credentials.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final long TOKEN_TTL_MINUTES = 30;

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens,
                                 PasswordEncoder passwordEncoder) {
        this.users = users;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Always succeeds from the caller's perspective, whether or not the email
     * exists — revealing that would let an attacker enumerate registered
     * accounts.
     */
    @Transactional
    public void requestReset(String email) {
        String normalized = email.trim().toLowerCase();
        users.findByEmail(normalized).ifPresent(this::issueAndLog);
    }

    private void issueAndLog(UserEntity user) {
        tokens.invalidateAllForUser(user.getId(), Instant.now());

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        PasswordResetTokenEntity entity = new PasswordResetTokenEntity();
        entity.setId(UUID.randomUUID());
        entity.setUserId(user.getId());
        entity.setTokenHash(sha256Hex(rawToken));
        entity.setExpiresAt(Instant.now().plus(TOKEN_TTL_MINUTES, ChronoUnit.MINUTES));
        tokens.save(entity);

        log.info("Password reset requested for {}. Reset link token (valid {} min): {}",
                user.getEmail(), TOKEN_TTL_MINUTES, rawToken);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        String hash = sha256Hex(rawToken);
        PasswordResetTokenEntity entity = tokens.findByTokenHash(hash)
                .orElseThrow(() -> new BadRequestException("INVALID_TOKEN", "Invalid or expired reset link"));

        if (entity.getUsedAt() != null) {
            throw new BadRequestException("INVALID_TOKEN", "Invalid or expired reset link");
        }
        if (entity.getExpiresAt().isBefore(Instant.now())) {
            throw new BadRequestException("INVALID_TOKEN", "Invalid or expired reset link");
        }

        UserEntity user = users.findById(entity.getUserId())
                .orElseThrow(() -> new BadRequestException("INVALID_TOKEN", "Invalid or expired reset link"));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        entity.setUsedAt(Instant.now());
        tokens.save(entity);
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
