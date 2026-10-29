package com.campus.complaints.repository;
import com.campus.complaints.model.*; import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findByRoleInOrderByNameAsc(Collection<Role> roles);
}
