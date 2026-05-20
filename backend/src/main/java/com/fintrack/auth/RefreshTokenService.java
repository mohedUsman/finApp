package com.fintrack.auth;

import com.fintrack.common.exception.UnauthorizedException;
import org.springframework.beans.factory.annotation.Value;
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

@Service
public class RefreshTokenService {

    private final RefreshTokenRepository repo;
    private final long refreshDays;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository repo,
                               @Value("${jwt.refresh-days}") long refreshDays) {
        this.repo = repo;
        this.refreshDays = refreshDays;
    }

    @Transactional
    public IssuedRefreshToken issue(UUID userId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = sha256Hex(rawToken);

        RefreshTokenEntity entity = new RefreshTokenEntity();
        entity.setId(UUID.randomUUID());
        entity.setUserId(userId);
        entity.setTokenHash(hash);
        entity.setExpiresAt(Instant.now().plus(refreshDays, ChronoUnit.DAYS));
        repo.save(entity);
        return new IssuedRefreshToken(rawToken, entity);
    }

    @Transactional
    public RefreshTokenEntity validateAndTouch(String rawToken) {
        String hash = sha256Hex(rawToken);
        RefreshTokenEntity entity = repo.findByTokenHash(hash)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));
        if (entity.getRevokedAt() != null) {
            throw new UnauthorizedException("Refresh token revoked");
        }
        if (entity.getExpiresAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Refresh token expired");
        }
        entity.setLastUsedAt(Instant.now());
        return repo.save(entity);
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        String hash = sha256Hex(rawToken);
        repo.findByTokenHash(hash).ifPresent(entity -> {
            if (entity.getRevokedAt() == null) {
                entity.setRevokedAt(Instant.now());
                repo.save(entity);
            }
        });
    }

    public long getRefreshDays() { return refreshDays; }

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

    public record IssuedRefreshToken(String rawToken, RefreshTokenEntity entity) {}
}
