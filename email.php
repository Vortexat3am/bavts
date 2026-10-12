<?php
// Contact form handler. js/main.js posts the form here and expects the text "sent" back
// ("failed" shows the error message). Sends a plain-text email to the class.
// Everything the visitor typed is cleaned first, so nobody can sneak extra email headers in
// (a common way spammers abuse contact forms).

$to = 'houghe@bavts.org';

// The form only checks for the exact word "sent", so PHP warnings must never be printed into the reply
// (they still go to the server's error log).
ini_set('display_errors', '0');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo 'failed';
    exit;
}

// Shorten text to $max characters.
function cap($value, $max)
{
    return function_exists('mb_substr') ? mb_substr($value, 0, $max, 'UTF-8') : substr($value, 0, $max);
}

// One line of text: no line breaks (those are how extra headers get added), trimmed, capped.
function one_line($value, $max)
{
    return cap(trim(preg_replace('/[\r\n\t]+/', ' ', (string) $value)), $max);
}

$name    = one_line($_POST['name'] ?? '', 100);
$email   = one_line($_POST['email'] ?? '', 254);
$subject = one_line($_POST['subject'] ?? '', 150);
$message = cap(trim(str_replace(["\r\n", "\r"], "\n", (string) ($_POST['your_message'] ?? ''))), 5000);

if ($name === '' || $subject === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo 'failed';
    exit;
}

// "From" has to be an address on this website's own domain, or many mail servers reject the email.
// The visitor's address goes in "Reply-To", so pressing Reply still answers them.
$domain = preg_replace('/^www\./', '', strtolower($_SERVER['SERVER_NAME'] ?? ''));
$domain = preg_replace('/[^a-z0-9.-]/', '', $domain);
$from   = 'noreply@' . ($domain !== '' ? $domain : 'bavtsbackstacks.org');

$headers  = "From: BavtsBackStacks website <{$from}>\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: quoted-printable";

// Subject: encoded so accents/emoji arrive intact, and split into short pieces as email requires
$subject_line = 'Contact Us: ' . $subject;
if (function_exists('mb_encode_mimeheader')) {
    $mail_subject = mb_encode_mimeheader($subject_line, 'UTF-8', 'B', "\r\n");
} else {
    $mail_subject = '=?UTF-8?B?' . base64_encode($subject_line) . '?=';
}

$body  = "New message from the BavtsBackStacks contact form\n\n";
$body .= "Name: {$name}\n";
$body .= "Email: {$email}\n";
$body .= "Subject: {$subject}\n\n";
$body .= $message . "\n";

// quoted-printable keeps every line short, so a long message with no line breaks still arrives intact
$body = quoted_printable_encode(str_replace("\n", "\r\n", $body));

echo mail($to, $mail_subject, $body, $headers) ? 'sent' : 'failed';
