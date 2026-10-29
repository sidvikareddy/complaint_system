package com.campus.complaints.security;
import com.campus.complaints.repository.UserRepository; import org.springframework.security.core.userdetails.*; import org.springframework.stereotype.Service;
@Service
public class CustomUserDetailsService implements UserDetailsService {
    private final UserRepository repository;
    public CustomUserDetailsService(UserRepository repository) { this.repository = repository; }
    @Override public UserDetails loadUserByUsername(String email) {
        var user = repository.findByEmail(email.toLowerCase()).orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return User.withUsername(user.getEmail()).password(user.getPassword()).roles(user.getRole().name()).build();
    }
}
