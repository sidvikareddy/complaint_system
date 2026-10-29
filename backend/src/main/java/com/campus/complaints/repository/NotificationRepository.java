package com.campus.complaints.repository;
import com.campus.complaints.model.*; import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findTop50ByRecipientIdOrderByCreatedAtDesc(Long recipientId);
    long countByRecipientIdAndReadAtIsNull(Long recipientId);
    Optional<Notification> findByIdAndRecipientId(Long id, Long recipientId);
}
