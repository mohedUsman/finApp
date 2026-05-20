package com.fintrack.user;

import com.fintrack.auth.dto.UserDto;
import com.fintrack.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/me")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
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
}
