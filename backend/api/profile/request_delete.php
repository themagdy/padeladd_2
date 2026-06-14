<?php
// backend/api/profile/request_delete.php

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Only POST method is allowed.', null, 405);
}

// Extract parameters
$name = $data['name'] ?? '';
$email = $data['email'] ?? '';
$phone = $data['phone'] ?? '';
$reason = $data['reason'] ?? 'Not specified';

// Validate required fields
if (empty($name) || empty($email) || empty($phone)) {
    jsonResponse(false, 'Full Name, Registered Email, and Registered Phone Number are required.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(false, 'Please enter a valid email address.');
}

// Format the email content
$subject = "Padeladd Account Deletion Request - " . $name;
$content = "A new account deletion request has been submitted from the web portal.\n\n"
         . "User Details:\n"
         . "---------------------------------\n"
         . "Name: " . $name . "\n"
         . "Email: " . $email . "\n"
         . "Phone: " . $phone . "\n"
         . "Reason: " . $reason . "\n\n"
         . "Please verify this user in the admin console and proceed with deletion.";

// Send email to support@padeladd.com
// Also we can send it to SMTP_FROM if we want it to land in your inbox.
$supportEmail = 'support@padeladd.com';
$sent = sendEmail($supportEmail, $subject, $content);

if ($sent) {
    jsonResponse(true, 'Your request has been submitted successfully. We will process it within 7 business days.');
} else {
    jsonResponse(false, 'Failed to send your request. Please try again or email us directly at support@padeladd.com.');
}
