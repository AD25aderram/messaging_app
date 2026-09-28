
package com.messaging.demo.service;

import java.io.UnsupportedEncodingException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

@Service // Tells Spring: create one instance of this and manage its lifecycle
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${app.mail.from-address}")
    private String fromAddress;

    @Value("${app.mail.from-name}")
    private String fromName;

    // Constructor injection - Spring sees this constructor and automatically
    // hands it the JavaMailSender bean it auto-configured from application.properties.
    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendInviteEmail(String toEmail, String inviteLink, String inviterName) throws MessagingException {
        if (fromAddress == null || fromAddress.isBlank()) {
            throw new IllegalStateException("Mail sender is not configured. Set MAIL_USERNAME and MAIL_PASSWORD.");
        }

        logger.info("Sending invite email to {}", toEmail);

        MimeMessage message = mailSender.createMimeMessage();
        // "true" here means "this message can have HTML/attachments", not just plain text
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        String subject = (inviterName != null && !inviterName.isBlank())
                ? inviterName + " invited you to connect"
                : "You've been invited to connect";

        String htmlContent = """
                <div style="font-family:sans-serif;line-height:1.5;">
                    <h2>%s</h2>
                    <p>Click the button below to accept the invite:</p>
                    <a href="%s"
                       style="display:inline-block;padding:10px 20px;background:#2563eb;
                              color:#ffffff;text-decoration:none;border-radius:6px;">
                        Accept Invite
                    </a>
                    <p style="color:#666;font-size:12px;">
                        Or copy this link into your browser: %s
                    </p>
                </div>
                """.formatted(subject, inviteLink, inviteLink);

        helper.setTo(toEmail);
        helper.setSubject(subject);
        helper.setText(htmlContent, true); // true = this is HTML, not plain text

        try {
            helper.setFrom(new InternetAddress(fromAddress, fromName));
        } catch (UnsupportedEncodingException e) {
            helper.setFrom(fromAddress); // fall back to a plain address, no display name
        }

        mailSender.send(message);
    }
}
