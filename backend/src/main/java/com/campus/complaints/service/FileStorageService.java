package com.campus.complaints.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;

@Service
public class FileStorageService {
    private final Path uploadDirectory;
    public FileStorageService(@Value("${app.upload-dir:uploads}") String directory) {
        uploadDirectory = Paths.get(directory).toAbsolutePath().normalize();
        try { Files.createDirectories(uploadDirectory); }
        catch (IOException e) { throw new IllegalStateException("Could not create upload directory", e); }
    }
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) return null;
        String type = file.getContentType();
        if (!"image/jpeg".equals(type) && !"image/png".equals(type))
            throw new IllegalArgumentException("Only JPEG and PNG images are allowed");
        String original = file.getOriginalFilename() == null ? "image" : Paths.get(file.getOriginalFilename()).getFileName().toString();
        String extension = original.toLowerCase().endsWith(".png") ? ".png" : ".jpg";
        String name = UUID.randomUUID() + extension;
        try { Files.copy(file.getInputStream(), uploadDirectory.resolve(name), StandardCopyOption.REPLACE_EXISTING); }
        catch (IOException e) { throw new IllegalStateException("Could not store uploaded image", e); }
        return "/uploads/" + name;
    }
}
