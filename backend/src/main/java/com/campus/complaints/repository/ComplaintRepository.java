package com.campus.complaints.repository;
import com.campus.complaints.model.*; import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    List<Complaint> findByStudentIdOrderByCreatedAtDesc(Long studentId);
    boolean existsByTitleIgnoreCaseAndLocationIgnoreCaseAndPriorityAndStatusIn(String title, String location, String priority, Collection<ComplaintStatus> statuses);
    long countByStatus(ComplaintStatus status);
}
