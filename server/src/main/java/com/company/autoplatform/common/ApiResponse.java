package com.company.autoplatform.common;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, T data, String message, String code, Object details) {

    public ApiResponse(boolean success, T data, String message) {
        this(success, data, message, null, null);
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, "OK");
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, data, message);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, null, message);
    }

    public static <T> ApiResponse<T> fail(String message, String code, Object details) {
        return new ApiResponse<>(false, null, message, code, details);
    }
}
