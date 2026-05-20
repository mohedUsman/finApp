package com.fintrack.auth;

import com.fintrack.auth.dto.AccessTokenResponse;
import com.fintrack.auth.dto.AuthResponse;
import com.fintrack.auth.dto.LoginRequest;
import com.fintrack.auth.dto.RegisterRequest;
import com.fintrack.common.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final String REFRESH_COOKIE = "refresh_token";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final AuthService auth;
    private final boolean cookieSecure;
    private final String sameSite;
    private final long refreshDays;

    public AuthController(AuthService auth,
                          @Value("${cookie.secure}") boolean cookieSecure,
                          @Value("${cookie.same-site}") String sameSite,
                          @Value("${jwt.refresh-days}") long refreshDays) {
        this.auth = auth;
        this.cookieSecure = cookieSecure;
        this.sameSite = sameSite;
        this.refreshDays = refreshDays;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req,
                                                 HttpServletResponse response) {
        AuthService.AuthResult result = auth.register(req);
        addRefreshCookie(response, result.rawRefreshToken());
        return ResponseEntity.ok(new AuthResponse(result.user(), result.accessToken(), result.expiresInSeconds()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req,
                                              HttpServletResponse response) {
        AuthService.AuthResult result = auth.login(req);
        addRefreshCookie(response, result.rawRefreshToken());
        return ResponseEntity.ok(new AuthResponse(result.user(), result.accessToken(), result.expiresInSeconds()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie) {
        if (refreshCookie == null || refreshCookie.isBlank()) {
            throw new UnauthorizedException("Missing refresh token");
        }
        return ResponseEntity.ok(auth.refresh(refreshCookie));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshCookie,
            HttpServletResponse response) {
        auth.logout(refreshCookie);
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    private void addRefreshCookie(HttpServletResponse response, String rawToken) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, rawToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(sameSite)
                .path(COOKIE_PATH)
                .maxAge(Duration.ofDays(refreshDays))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(sameSite)
                .path(COOKIE_PATH)
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
