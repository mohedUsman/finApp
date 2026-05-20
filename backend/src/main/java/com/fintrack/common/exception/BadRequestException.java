package com.fintrack.common.exception;

import com.fintrack.common.FieldError;
import org.springframework.http.HttpStatus;

import java.util.List;

public class BadRequestException extends ApiException {
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, "BAD_REQUEST", message);
    }
    public BadRequestException(String errorCode, String message) {
        super(HttpStatus.BAD_REQUEST, errorCode, message);
    }
    public BadRequestException(String message, List<FieldError> fieldErrors) {
        super(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message, fieldErrors);
    }
}
