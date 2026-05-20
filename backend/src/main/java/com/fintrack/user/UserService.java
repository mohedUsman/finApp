package com.fintrack.user;

import com.fintrack.auth.dto.UserDto;
import com.fintrack.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository users;

    public UserService(UserRepository users) {
        this.users = users;
    }

    public UserDto getMe(UUID userId) {
        return toDto(findUser(userId));
    }

    @Transactional
    public UserDto updateMe(UUID userId, UpdateMeRequest req) {
        UserEntity user = findUser(userId);
        if (req.phone() != null) user.setPhone(req.phone());
        if (req.timezone() != null) user.setTimezone(req.timezone());
        if (req.baseCurrencyCode() != null) user.setBaseCurrencyCode(req.baseCurrencyCode());
        return toDto(user);
    }

    private UserEntity findUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private UserDto toDto(UserEntity u) {
        return new UserDto(u.getId(), u.getEmail(), u.getPhone(), u.getTimezone(), u.getBaseCurrencyCode());
    }
}
