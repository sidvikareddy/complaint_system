package com.campus.complaints.controller;

import com.campus.complaints.model.*; import com.campus.complaints.repository.UserRepository; import com.campus.complaints.security.JwtService;
import jakarta.validation.Valid; import jakarta.validation.constraints.*; import org.springframework.beans.factory.annotation.Value; import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder; import org.springframework.security.core.Authentication; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users; private final PasswordEncoder encoder; private final JwtService jwt; private final String adminPasscode;
    public AuthController(UserRepository users, PasswordEncoder encoder, JwtService jwt, @Value("${admin.passcode}") String adminPasscode) {
        this.users = users; this.encoder = encoder; this.jwt = jwt; this.adminPasscode = adminPasscode;
    }
    public record RegisterRequest(@NotBlank String name, @NotBlank @Email String email, @NotBlank @Size(min=6) String password,
                                  String studentId, String staffId, String department, Role role, String adminPasscode) {}
    public record LoginRequest(String identifier, String email, String password, String adminPasscode, Role role) {}
    @PostMapping("/register") public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        Role role = request.role() == null ? Role.STUDENT : request.role();
        if (role == Role.ADMIN && !Objects.equals(request.adminPasscode(), adminPasscode)) return error(HttpStatus.BAD_REQUEST, "Invalid Admin Passcode!");
        if (role == Role.STUDENT && (blank(request.studentId()) || blank(request.department()))) return error(HttpStatus.BAD_REQUEST, "Student ID and department are required");
        if (users.existsByEmail(request.email().trim().toLowerCase())) return error(HttpStatus.CONFLICT, "Email already registered");
        User user = new User(); user.setName(blank(request.name()) ? request.email().split("@")[0] : request.name().trim()); user.setEmail(request.email());
        user.setPassword(encoder.encode(request.password())); user.setRole(role); user.setStudentId(request.studentId()); user.setStaffId(request.staffId());
        user.setDepartment(role == Role.ADMIN ? "" : Optional.ofNullable(request.department()).orElse(""));
        users.save(user); return ResponseEntity.status(HttpStatus.CREATED).body(authResponse(user));
    }
    @PostMapping("/login") public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        String identifier = Optional.ofNullable(request.identifier()).orElse(request.email());
        if (blank(identifier)) return error(HttpStatus.BAD_REQUEST, "Login identifier is required");
        User user = users.findByEmail(identifier.trim().toLowerCase()).orElse(null);
        if (request.role() == Role.STUDENT && user == null) user = users.findAll().stream().filter(u -> identifier.equalsIgnoreCase(u.getStudentId())).findFirst().orElse(null);
        boolean valid = user != null && (request.role() == Role.ADMIN ? Objects.equals(request.adminPasscode(), adminPasscode) : request.password() != null && encoder.matches(request.password(), user.getPassword()));
        if (!valid) return error(HttpStatus.UNAUTHORIZED, request.role() == Role.ADMIN ? "Invalid admin passcode" : "Invalid email or password");
        if (request.role() != null && request.role() != user.getRole()) return error(HttpStatus.FORBIDDEN, "This account is not registered as " + request.role().value());
        return ResponseEntity.ok(authResponse(user));
    }
    @GetMapping("/me") public Map<String,Object> me(Authentication auth) { return Map.of("user", publicUser(users.findByEmail(auth.getName()).orElseThrow())); }
    @GetMapping("/staff") @PreAuthorize("hasRole('ADMIN')") public List<Map<String,Object>> staff() {
        return users.findByRoleInOrderByNameAsc(List.of(Role.STAFF, Role.ADMIN)).stream().map(this::publicUser).toList();
    }
    @PostMapping("/staff") @PreAuthorize("hasRole('ADMIN')") public ResponseEntity<?> createStaff(@RequestBody RegisterRequest request) {
        if (users.existsByEmail(request.email().toLowerCase())) return error(HttpStatus.CONFLICT, "Email already registered");
        User u = new User(); u.setName(request.name()); u.setEmail(request.email()); u.setPassword(encoder.encode(request.password())); u.setRole(Role.STAFF); u.setDepartment(request.department());
        users.save(u); return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("user", publicUser(u)));
    }
    private Map<String,Object> authResponse(User u) { return Map.of("token", jwt.createToken(u.getId(), u.getEmail(), u.getRole().value()), "user", publicUser(u)); }
    private Map<String,Object> publicUser(User u) { return Map.of("id", u.getId(), "name", u.getName(), "email", u.getEmail(), "role", u.getRole().value(), "studentId", Objects.toString(u.getStudentId(), ""), "staffId", Objects.toString(u.getStaffId(), ""), "department", Objects.toString(u.getDepartment(), "")); }
    private static boolean blank(String s) { return s == null || s.isBlank(); }
    private static ResponseEntity<Map<String,String>> error(HttpStatus status, String message) { return ResponseEntity.status(status).body(Map.of("message", message)); }
}
