package com.campus.complaints.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;

@Entity @Table(name = "complaints")
@Getter @Setter @NoArgsConstructor
public class Complaint {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) private User student;
    @Column(nullable = false, length = 120) private String title;
    @Column(nullable = false) private String category;
    private String location = "";
    @Column(nullable = false, length = 2000) private String description;
    private String priority = "Medium";
    @Enumerated(EnumType.STRING) @Column(nullable = false) private ComplaintStatus status = ComplaintStatus.PENDING;
    private String adminRemarks = "";
    @ElementCollection @CollectionTable(name = "complaint_evidence", joinColumns = @JoinColumn(name = "complaint_id"))
    private List<Evidence> evidence = new ArrayList<>();
    @ElementCollection @CollectionTable(name = "complaint_history", joinColumns = @JoinColumn(name = "complaint_id"))
    private List<HistoryEntry> history = new ArrayList<>();
    @ElementCollection @CollectionTable(name = "complaint_upvotes", joinColumns = @JoinColumn(name = "complaint_id"))
    @Column(name = "user_id") private Set<Long> upvotedBy = new HashSet<>();
    @Column(nullable = false, updatable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }

    @Embeddable @Getter @Setter @NoArgsConstructor
    public static class Evidence {
        private String url; private String originalName; private String mimeType; private long size;
        public Evidence(String url, String originalName, String mimeType, long size) {
            this.url = url; this.originalName = originalName; this.mimeType = mimeType; this.size = size;
        }
    }
    @Embeddable @Getter @Setter @NoArgsConstructor
    public static class HistoryEntry {
        @Enumerated(EnumType.STRING) private ComplaintStatus status;
        private String remarks; private Long changedBy; private Instant changedAt;
        public HistoryEntry(ComplaintStatus status, String remarks, Long changedBy) {
            this.status = status; this.remarks = remarks; this.changedBy = changedBy; this.changedAt = Instant.now();
        }
    }
}
