package com.fintrack.auth;

import com.fintrack.common.exception.UnauthorizedException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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

    /**
     * Self-reference through the Spring proxy. A plain {@code this.method()}
     * call bypasses the proxy, so {@code REQUIRES_NEW} would be ignored and the
     * breach revocation would join — and roll back with — the caller.
     */
    private final ObjectProvider<RefreshTokenService> selfProvider;

    public RefreshTokenService(RefreshTokenRepository repo,
                               @Value("${jwt.refresh-days}") long refreshDays,
                               ObjectProvider<RefreshTokenService> selfProvider) {
        this.repo = repo;
        this.refreshDays = refreshDays;
        this.selfProvider = selfProvider;
    }

    private RefreshTokenService self() {
        return selfProvider.getObject();
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

    /**
     * Consumes a refresh token and issues its replacement (rotation).
     *
     * <p>Each token is single-use: presenting one revokes it and returns a new
     * one, so a stolen cookie is only valid until the victim's next refresh.
     *
     * <p>Presenting an <em>already-revoked</em> token means two parties hold
     * the same token — the legitimate user already rotated it and someone is
     * replaying the old copy. We cannot tell which caller is which, so every
     * live token for that user is revoked and both are forced to log in again.
     */
    @Transactional
    public IssuedRefreshToken rotate(String rawToken) {
        String hash = sha256Hex(rawToken);
        RefreshTokenEntity entity = repo.findByTokenHash(hash)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (entity.getRevokedAt() != null) {
            // Must commit independently: throwing below rolls this transaction
            // back, which would silently undo the revocation.
            self().revokeAllForUserInNewTransaction(entity.getUserId());
            throw new UnauthorizedException("Refresh token reuse detected");
        }
        if (entity.getExpiresAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Refresh token expired");
        }

        Instant now = Instant.now();
        entity.setLastUsedAt(now);
        entity.setRevokedAt(now);
        repo.save(entity);

        return issue(entity.getUserId());
    }

    /**
     * Revokes every live token for a user in its own transaction, so the
     * revocation survives the caller rolling back.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revokeAllForUserInNewTransaction(UUID userId) {
        repo.revokeAllForUser(userId, Instant.now());
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
