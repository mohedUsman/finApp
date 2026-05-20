package com.fintrack.common;

import java.util.List;

public record ErrorResponse(String errorCode, String message, List<FieldError> fieldErrors, String traceId) {
    public static ErrorResponse of(String errorCode, String message) {
        return new ErrorResponse(errorCode, message, null, null);
    }
    public static ErrorResponse of(String errorCode, String message, List<FieldError> fieldErrors) {
        return new ErrorResponse(errorCode, message, fieldErrors, null);
    }
}
