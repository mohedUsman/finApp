package com.fintrack.user;

import jakarta.validation.constraints.Size;

public record UpdateMeRequest(
        @Size(max = 20) String phone,
        @Size(max = 64) String timezone,
        @Size(min = 3, max = 3) String baseCurrencyCode
) {}
