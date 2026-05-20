package com.fintrack.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtService {

    private final SecretKey key;
    private final long accessMinutes;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.access-minutes}") long accessMinutes) {
        byte[] keyBytes = decodeSecret(secret);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("jwt.secret must decode to at least 256 bits (32 bytes). " +
                    "Generate one with: openssl rand -base64 48");
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.accessMinutes = accessMinutes;
    }

    public String generateAccessToken(UUID userId) {
        Instant now = Instant.now();
        Instant exp = now.plus(accessMinutes, ChronoUnit.MINUTES);
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key)
                .compact();
    }

    public UUID parseUserId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return UUID.fromString(claims.getSubject());
    }

    public long getAccessExpiresInSeconds() {
        return accessMinutes * 60L;
    }

    private static byte[] decodeSecret(String secret) {
        return secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
