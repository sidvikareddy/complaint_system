package com.campus.complaints.controller;
import com.campus.complaints.model.*; import com.campus.complaints.repository.*; import com.campus.complaints.service.ComplaintService; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.Authentication; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/api/admin") @PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final ComplaintService service; private final UserRepository users; private final ComplaintRepository complaints;
    public AdminController(ComplaintService service, UserRepository users, ComplaintRepository complaints) { this.service=service; this.users=users; this.complaints=complaints; }
    @PutMapping("/complaints/{id}/status")
    public Complaint status(@PathVariable Long id, @RequestBody Map<String,String> body, Authentication auth) {
        User admin=users.findByEmail(auth.getName()).orElseThrow(); return service.updateStatus(id, ComplaintStatus.fromValue(body.get("status")), body.get("remarks"), admin);
    }
    @PutMapping("/complaints/{id}")
    public Complaint legacyStatus(@PathVariable Long id, @RequestBody Map<String,String> body, Authentication auth) {
        return status(id, body, auth);
    }
    @GetMapping("/complaints") public Map<String,Object> complaints(@RequestParam(required=false) String status, @RequestParam(required=false) String category, @RequestParam(required=false,name="search") String search) {
        List<Complaint> list=complaints.findAll().stream().filter(c->status==null||status.isBlank()||c.getStatus()==ComplaintStatus.fromValue(status)).filter(c->category==null||category.isBlank()||c.getCategory().equals(category)).filter(c->search==null||search.isBlank()||(c.getTitle()+" "+c.getLocation()).toLowerCase().contains(search.toLowerCase())).toList();
        return Map.of("items",list,"complaints",list,"total",list.size(),"page",1,"limit",list.size());
    }
    @GetMapping("/analytics") public Map<String,Object> analytics() {
        Map<String,Object> result=new LinkedHashMap<>(); result.put("total",complaints.count());
        result.put("pending",complaints.countByStatus(ComplaintStatus.PENDING)); result.put("inProgress",complaints.countByStatus(ComplaintStatus.IN_PROGRESS));
        result.put("resolved",complaints.countByStatus(ComplaintStatus.RESOLVED)); result.put("rejected",complaints.countByStatus(ComplaintStatus.REJECTED));
        result.put("Total",complaints.count()); result.put("Pending",result.get("pending")); result.put("In Progress",result.get("inProgress")); result.put("Resolved",result.get("resolved")); result.put("Rejected",result.get("rejected")); return result;
    }
}
