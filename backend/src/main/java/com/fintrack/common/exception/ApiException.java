package com.fintrack.common.exception;

import com.fintrack.common.FieldError;
import org.springframework.http.HttpStatus;

import java.util.List;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;
    private final List<FieldError> fieldErrors;

    public ApiException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, null);
    }

    public ApiException(HttpStatus status, String errorCode, String message, List<FieldError> fieldErrors) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.fieldErrors = fieldErrors;
    }

    public HttpStatus getStatus() { return status; }
    public String getErrorCode() { return errorCode; }
    public List<FieldError> getFieldErrors() { return fieldErrors; }
}
