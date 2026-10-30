package com.zettaremit.transaction.controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice
public class SafeErrors {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<java.util.Map<String,String>> invalid(Exception ignored) {
        return ResponseEntity.badRequest().body(java.util.Map.of("detail", "Invalid simulation request"));
    }
}
