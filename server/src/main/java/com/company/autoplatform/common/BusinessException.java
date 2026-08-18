package com.company.autoplatform.common;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Object details;

    public BusinessException(HttpStatus status, String code, String message, Object details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public Object details() {
        return details;
    }
}
