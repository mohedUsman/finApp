package com.fintrack.auth.dto;

public record AuthResponse(UserDto user, String accessToken, long expiresInSeconds) {}
