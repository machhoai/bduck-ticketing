/**
 * Nodemailer transporter configured for Brevo SMTP.
 * Centralised here so all email modules share a single connection pool.
 *
 * Required env vars (set in .env.local):
 *   BREVO_SMTP_SERVER  — e.g. smtp-relay.brevo.com
 *   BREVO_SMTP_PORT    — e.g. 587
 *   BREVO_SMTP_LOGIN   — Brevo SMTP login
 *   BREVO_API_KEY      — used as the SMTP password
 *   BREVO_SENDER_EMAIL — (optional) verified sender, defaults to BREVO_SMTP_LOGIN
 */
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_SERVER ?? "smtp-relay.brevo.com",
    port: Number(process.env.BREVO_SMTP_PORT ?? 587),
    secure: false, // STARTTLS on port 587
    auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_API_KEY,
    },
});

export const FROM_ADDRESS = `B.Duck Cityfuns <${process.env.BREVO_SENDER_EMAIL ?? process.env.BREVO_SMTP_LOGIN ?? "noreply@bduck.vn"
    }>`;

export default transporter;
