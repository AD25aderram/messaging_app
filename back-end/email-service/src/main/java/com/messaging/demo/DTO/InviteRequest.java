package com.messaging.demo.DTO;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Shape of the JSON the frontend sends when a user clicks "invite":
 * {
 *   "toEmail": "friend@example.com",
 *   "inviteLink": "https://yourapp.com/invite?token=abc123",
 *   "inviterName": "Adam"
 * }
 */
public class InviteRequest {

    @NotBlank(message = "Recipient email is required")
    @Email(message = "Recipient email must be a valid email address")
    private String toEmail;

    @NotBlank(message = "Invite link is required")
    private String inviteLink;

    // Optional - purely for personalizing the email subject/body
    private String inviterName;

    public String getToEmail() {
        return toEmail;
    }

    public void setToEmail(String toEmail) {
        this.toEmail = toEmail;
    }

    public String getInviteLink() {
        return inviteLink;
    }

    public void setInviteLink(String inviteLink) {
        this.inviteLink = inviteLink;
    }

    public String getInviterName() {
        return inviterName;
    }

    public void setInviterName(String inviterName) {
        this.inviterName = inviterName;
    }
}
