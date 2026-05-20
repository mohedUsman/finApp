package com.fintrack.auth.dto;

import java.util.UUID;

public record UserDto(UUID id, String email, String phone, String timezone, String baseCurrencyCode) {}
