package com.campus.complaints.controller;
import com.campus.complaints.model.*; import com.campus.complaints.repository.*; import org.springframework.security.core.Authentication; import org.springframework.web.bind.annotation.*; import java.time.Instant; import java.util.*;
@RestController @RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationRepository notifications; private final UserRepository users;
    public NotificationController(NotificationRepository n, UserRepository u) { notifications=n; users=u; }
    @GetMapping public Map<String,Object> list(Authentication auth) { Long id=user(auth).getId(); return Map.of("notifications",notifications.findTop50ByRecipientIdOrderByCreatedAtDesc(id),"unreadCount",notifications.countByRecipientIdAndReadAtIsNull(id)); }
    @PatchMapping("/read-all") public Map<String,String> readAll(Authentication auth) { notifications.findTop50ByRecipientIdOrderByCreatedAtDesc(user(auth).getId()).stream().filter(n->n.getReadAt()==null).forEach(n->{n.setReadAt(Instant.now());notifications.save(n);}); return Map.of("message","Notifications marked as read"); }
    @PatchMapping("/{id}/read") public Notification read(@PathVariable Long id, Authentication auth) { Notification n=notifications.findByIdAndRecipientId(id,user(auth).getId()).orElseThrow(); n.setReadAt(Instant.now()); return notifications.save(n); }
    private User user(Authentication a) { return users.findByEmail(a.getName()).orElseThrow(); }
}
