package com.campus.complaints.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name = "notifications")
@Getter @Setter @NoArgsConstructor
public class Notification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) private User recipient;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) private Complaint complaint;
    private String type = "status_update";
    private String title;
    @Column(length = 2000) private String message;
    private Instant readAt;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
