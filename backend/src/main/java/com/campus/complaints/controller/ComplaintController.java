package com.campus.complaints.controller;

import com.campus.complaints.model.*; import com.campus.complaints.repository.*; import com.campus.complaints.service.ComplaintService; import org.springframework.http.*; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.Authentication; import org.springframework.web.bind.annotation.*; import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController @RequestMapping("/api/complaints")
public class ComplaintController {
    private final ComplaintRepository complaints; private final UserRepository users; private final ComplaintService service;
    public ComplaintController(ComplaintRepository c, UserRepository u, ComplaintService s) { complaints=c; users=u; service=s; }
    @GetMapping("/meta") public Map<String,Object> meta() { return Map.of("statuses", Arrays.stream(ComplaintStatus.values()).map(ComplaintStatus::value).toList(), "categories", ComplaintService.CATEGORIES, "departments", ComplaintService.DEPARTMENTS); }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Complaint> create(@RequestParam("title") String title, @RequestParam("category") String category, @RequestParam(value="location",required=false, defaultValue="") String location, @RequestParam("description") String description, @RequestParam(value="priority",defaultValue="Medium") String priority, @RequestParam(value="file",required=false) MultipartFile file, @RequestParam(value="evidence",required=false) MultipartFile evidence, Authentication auth) {
        User student = current(auth); return ResponseEntity.status(HttpStatus.CREATED).body(service.create(student,title,category,location,description,priority,file != null ? file : evidence));
    }
    @GetMapping("/mine") @PreAuthorize("hasRole('STUDENT')") public Map<String,Object> mine(Authentication auth) {
        List<Complaint> list=complaints.findByStudentIdOrderByCreatedAtDesc(current(auth).getId()); Map<String,Long> stats=new LinkedHashMap<>(); stats.put("total",(long)list.size()); for(ComplaintStatus s:ComplaintStatus.values()) stats.put(s.value(),list.stream().filter(c->c.getStatus()==s).count()); return Map.of("stats",stats,"complaints",list);
    }
    @GetMapping("/{id}") public ResponseEntity<?> get(@PathVariable Long id, Authentication auth) {
        Complaint c=complaints.findById(id).orElse(null); if(c==null)return ResponseEntity.notFound().build(); User u=current(auth); if(u.getRole()!=Role.ADMIN&&!c.getStudent().getId().equals(u.getId()))return ResponseEntity.status(403).body(Map.of("message","Forbidden")); return ResponseEntity.ok(c);
    }
    @PatchMapping("/{id}/status") @PreAuthorize("hasRole('ADMIN')")
    public Complaint update(@PathVariable Long id, @RequestBody Map<String,String> body, Authentication auth) { return service.updateStatus(id,ComplaintStatus.fromValue(body.get("status")),body.get("remarks"),current(auth)); }
    @GetMapping @PreAuthorize("hasRole('ADMIN')") public Map<String,Object> all(@RequestParam(required=false) String status,@RequestParam(required=false) String category,@RequestParam(required=false,name="q") String query) {
        List<Complaint> list=complaints.findAll().stream().filter(c->status==null||status.isBlank()||c.getStatus()==ComplaintStatus.fromValue(status)).filter(c->category==null||category.isBlank()||c.getCategory().equals(category)).filter(c->query==null||query.isBlank()||(c.getTitle()+" "+c.getDescription()+" "+c.getLocation()).toLowerCase().contains(query.toLowerCase())).toList(); return Map.of("items",list,"complaints",list,"total",list.size());
    }
    @GetMapping("/stats") @PreAuthorize("hasRole('ADMIN')") public Map<String,Object> stats() { Map<String,Long> status=new LinkedHashMap<>(); for(ComplaintStatus s:ComplaintStatus.values())status.put(s.value(),complaints.countByStatus(s)); return Map.of("total",complaints.count(),"status",status); }
    private User current(Authentication a) { return users.findByEmail(a.getName()).orElseThrow(); }
}
