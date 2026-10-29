package com.campus.complaints.config;
import com.campus.complaints.service.ComplaintService; import org.springframework.http.*; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ComplaintService.ConflictException.class) ResponseEntity<Map<String,String>> conflict(RuntimeException e) { return response(HttpStatus.CONFLICT,e.getMessage()); }
    @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<Map<String,String>> bad(RuntimeException e) { return response(HttpStatus.BAD_REQUEST,e.getMessage()); }
    @ExceptionHandler(NoSuchElementException.class) ResponseEntity<Map<String,String>> missing(RuntimeException e) { return response(HttpStatus.NOT_FOUND,e.getMessage()); }
    @ExceptionHandler(Exception.class) ResponseEntity<Map<String,String>> generic(Exception e) { return response(HttpStatus.INTERNAL_SERVER_ERROR,"Server error"); }
    private ResponseEntity<Map<String,String>> response(HttpStatus status,String message) { return ResponseEntity.status(status).body(Map.of("message",message == null ? "Request failed" : message)); }
}
