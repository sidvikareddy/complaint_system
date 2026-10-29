package com.campus.complaints.security;

import io.jsonwebtoken.*; import io.jsonwebtoken.security.Keys; import org.springframework.beans.factory.annotation.Value; import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets; import java.security.Key; import java.util.Date;

@Service
public class JwtService {
    private final Key key; private final long expiration;
    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.expiration:604800000}") long expiration) {
        if (secret.length() < 32) throw new IllegalArgumentException("app.jwt.secret must contain at least 32 characters");
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)); this.expiration = expiration;
    }
    public String createToken(Long id, String email, String role) {
        Date now = new Date();
        return Jwts.builder().subject(email).claim("id", id).claim("role", role).issuedAt(now)
                .expiration(new Date(now.getTime() + expiration)).signWith(key).compact();
    }
    public String extractEmail(String token) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject(); }
}
