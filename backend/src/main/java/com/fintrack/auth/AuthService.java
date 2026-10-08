package com.fintrack.auth;

import com.fintrack.auth.dto.AccessTokenResponse;
import com.fintrack.auth.dto.LoginRequest;
import com.fintrack.auth.dto.RegisterRequest;
import com.fintrack.auth.dto.UserDto;
import com.fintrack.category.DefaultCategorySeeder;
import com.fintrack.common.exception.ConflictException;
import com.fintrack.common.exception.UnauthorizedException;
import com.fintrack.networth.DefaultAssetCategorySeeder;
import com.fintrack.security.JwtService;
import com.fintrack.user.UserEntity;
import com.fintrack.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final RefreshTokenService refreshTokens;
    private final DefaultCategorySeeder categorySeeder;
    private final DefaultAssetCategorySeeder assetCategorySeeder;

    public AuthService(UserRepository users,
                       PasswordEncoder encoder,
                       JwtService jwt,
                       RefreshTokenService refreshTokens,
                       DefaultCategorySeeder categorySeeder,
                       DefaultAssetCategorySeeder assetCategorySeeder) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.refreshTokens = refreshTokens;
        this.categorySeeder = categorySeeder;
        this.assetCategorySeeder = assetCategorySeeder;
    }

    @Transactional
    public AuthResult register(RegisterRequest req) {
        String email = req.email().toLowerCase().trim();
        if (users.existsByEmail(email)) {
            throw new ConflictException("EMAIL_TAKEN", "Email already registered");
        }
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(req.password()));
        user.setPhone(req.phone());
        users.save(user);
        categorySeeder.seedForUser(user.getId());
        assetCategorySeeder.seedForUser(user.getId());
        return issueTokens(user);
    }

    @Transactional
    public AuthResult login(LoginRequest req) {
        String email = req.email().toLowerCase().trim();
        UserEntity user = users.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));
        if (!encoder.matches(req.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials");
        }
        return issueTokens(user);
    }

    /**
     * Rotates the refresh token and mints a new access token. The caller must
     * send the returned {@code rawRefreshToken} back as a cookie — the presented
     * one is now revoked.
     */
    @Transactional
    public RefreshResult refresh(String rawRefreshToken) {
        RefreshTokenService.IssuedRefreshToken rotated = refreshTokens.rotate(rawRefreshToken);
        UUID userId = rotated.entity().getUserId();
        if (!users.existsById(userId)) {
            throw new UnauthorizedException("Unknown user");
        }
        String accessToken = jwt.generateAccessToken(userId);
        return new RefreshResult(
                new AccessTokenResponse(accessToken, jwt.getAccessExpiresInSeconds()),
                rotated.rawToken());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.revoke(rawRefreshToken);
    }

    private AuthResult issueTokens(UserEntity user) {
        String accessToken = jwt.generateAccessToken(user.getId());
        RefreshTokenService.IssuedRefreshToken issued = refreshTokens.issue(user.getId());
        return new AuthResult(toDto(user), accessToken, jwt.getAccessExpiresInSeconds(), issued.rawToken());
    }

    private UserDto toDto(UserEntity u) {
        return new UserDto(u.getId(), u.getEmail(), u.getPhone(), u.getTimezone(), u.getBaseCurrencyCode());
    }

    public record AuthResult(UserDto user, String accessToken, long expiresInSeconds, String rawRefreshToken) {}

    public record RefreshResult(AccessTokenResponse accessToken, String rawRefreshToken) {}
}
