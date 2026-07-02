package com.fintrack.user;

import com.fintrack.auth.dto.UserDto;
import com.fintrack.security.CurrentUser;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/me")
public class UserController {

    private static final String REFRESH_COOKIE = "refresh_token";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final UserService userService;
    private final boolean cookieSecure;
    private final String sameSite;

    public UserController(UserService userService,
                          @Value("${cookie.secure}") boolean cookieSecure,
                          @Value("${cookie.same-site}") String sameSite) {
        this.userService = userService;
        this.cookieSecure = cookieSecure;
        this.sameSite = sameSite;
    }

    @GetMapping
    public ResponseEntity<UserDto> getMe(@CurrentUser UUID userId) {
        return ResponseEntity.ok(userService.getMe(userId));
    }

    @PatchMapping
    public ResponseEntity<UserDto> updateMe(@CurrentUser UUID userId,
                                             @Valid @RequestBody UpdateMeRequest req) {
        return ResponseEntity.ok(userService.updateMe(userId, req));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteMe(@CurrentUser UUID userId,
                                          @Valid @RequestBody DeleteAccountRequest req,
                                          HttpServletResponse response) {
        userService.deleteMe(userId, req);
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
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
