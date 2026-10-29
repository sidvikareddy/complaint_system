package com.campus.complaints.security;
import jakarta.servlet.*; import jakarta.servlet.http.*; import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.security.core.userdetails.UserDetails; import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component; import org.springframework.lang.NonNull; import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;
import io.jsonwebtoken.JwtException; import org.springframework.security.core.userdetails.UsernameNotFoundException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwt; private final CustomUserDetailsService users;
    public JwtAuthenticationFilter(JwtService jwt, CustomUserDetailsService users) { this.jwt = jwt; this.users = users; }
    @Override protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                String email = jwt.extractEmail(header.substring(7)); UserDetails user = users.loadUserByUsername(email);
                var auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request)); SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException | UsernameNotFoundException ex) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED); response.setContentType("application/json");
                response.getWriter().write("{\"message\":\"Invalid or expired token\"}"); return;
            }
        }
        chain.doFilter(request, response);
    }
}
