package com.campus.complaints.service;

import com.campus.complaints.model.*; import com.campus.complaints.repository.*; import org.springframework.stereotype.Service; import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@Service
public class ComplaintService {
    public static final List<String> CATEGORIES = List.of("Classroom","Wi-Fi","Facilities","Library","Hostel","Other");
    public static final List<String> DEPARTMENTS = List.of("Classroom","IT Support","Facilities","Library","Hostel","General");
    private final ComplaintRepository complaints; private final UserRepository users; private final NotificationRepository notifications; private final FileStorageService files;
    public ComplaintService(ComplaintRepository c, UserRepository u, NotificationRepository n, FileStorageService f) { complaints=c; users=u; notifications=n; files=f; }
    public Complaint create(User student, String title, String category, String location, String description, String priority, MultipartFile file) {
        if (blank(title) || blank(category) || blank(description)) throw new IllegalArgumentException("Title, category and description are required");
        if (!CATEGORIES.contains(category)) throw new IllegalArgumentException("Invalid category");
        if (!List.of("Low","Medium","High").contains(priority)) throw new IllegalArgumentException("Invalid priority");
        if (complaints.existsByTitleIgnoreCaseAndLocationIgnoreCaseAndPriorityAndStatusIn(title.trim(), Optional.ofNullable(location).orElse("").trim(), priority, List.of(ComplaintStatus.PENDING, ComplaintStatus.IN_PROGRESS)))
            throw new ConflictException("This complaint has already been raised at this location with the same priority.");
        Complaint c = new Complaint(); c.setStudent(student); c.setTitle(title.trim()); c.setCategory(category); c.setLocation(Optional.ofNullable(location).orElse("").trim()); c.setDescription(description.trim()); c.setPriority(priority);
        String url = files.store(file); if (url != null) c.getEvidence().add(new Complaint.Evidence(url, file.getOriginalFilename(), file.getContentType(), file.getSize()));
        c.getHistory().add(new Complaint.HistoryEntry(ComplaintStatus.PENDING, "Complaint submitted", student.getId())); c = complaints.save(c);
        for (User admin : users.findByRoleInOrderByNameAsc(List.of(Role.ADMIN))) notify(admin, c, "complaint_submitted", "New complaint submitted", "\"" + c.getTitle() + "\" was submitted by " + student.getName() + ".");
        return c;
    }
    public Complaint updateStatus(Long id, ComplaintStatus status, String remarks, User admin) {
        if (status == null) throw new IllegalArgumentException("Invalid status");
        Complaint c = complaints.findById(id).orElseThrow(() -> new NoSuchElementException("Complaint not found")); ComplaintStatus old = c.getStatus();
        c.setStatus(status); c.setAdminRemarks(Optional.ofNullable(remarks).orElse("")); c.getHistory().add(new Complaint.HistoryEntry(status, c.getAdminRemarks(), admin.getId()));
        c = complaints.save(c); if (old != status) notify(c.getStudent(), c, "status_update", "Complaint status updated", "\"" + c.getTitle() + "\" is now " + status.value() + (c.getAdminRemarks().isBlank() ? "." : ": " + c.getAdminRemarks()));
        return c;
    }
    public void notify(User recipient, Complaint complaint, String type, String title, String message) { Notification n=new Notification(); n.setRecipient(recipient); n.setComplaint(complaint); n.setType(type); n.setTitle(title); n.setMessage(message); notifications.save(n); }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    public static class ConflictException extends RuntimeException { public ConflictException(String message) { super(message); } }
}
