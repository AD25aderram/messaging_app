package com.messaging.demo.controller;


import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.messaging.demo.DTO.InviteRequest;
import com.messaging.demo.service.EmailService;

import jakarta.mail.MessagingException;
import jakarta.validation.Valid;

@RestController // = @Controller + @ResponseBody: return values become JSON automatically
@RequestMapping("/api/invite")
public class InviteController {

    private final EmailService emailService;

    public InviteController(EmailService emailService) {
        this.emailService = emailService;
    }

    // Handles: POST http://localhost:8080/java-service/api/invite
    // Body: { "toEmail": "...", "inviteLink": "...", "inviterName": "..." }
    @PostMapping
    public ResponseEntity<?> sendInvite(@Valid @RequestBody InviteRequest request) {
        try {
            emailService.sendInviteEmail(
                    request.getToEmail(),
                    request.getInviteLink(),
                    request.getInviterName()
            );
            return ResponseEntity.ok(Map.of(
                    "status", "sent",
                    "to", request.getToEmail()
            ));
        } catch (MessagingException | IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "status", "error",
                            "message", e.getMessage() != null ? e.getMessage() : "Failed to send email. Please try again later."
                    ));
        }
    }
}
 
