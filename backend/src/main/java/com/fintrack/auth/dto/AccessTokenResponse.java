package com.fintrack.auth.dto;

public record AccessTokenResponse(String accessToken, long expiresInSeconds) {}
