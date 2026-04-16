/**
 * SMTP Diagnostic script — run with: npx tsx src/lib/email/diagnostic.ts
 * Tests the actual SMTP connection and sends a real test email.
 */
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function diagnose() {
  console.log("=== SMTP DIAGNOSTIC ===\n");

  // 1. Check env vars
  const host = process.env.BREVO_SMTP_SERVER;
  const port = process.env.BREVO_SMTP_PORT;
  const login = process.env.BREVO_SMTP_LOGIN;
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;

  console.log("BREVO_SMTP_SERVER:", host ?? "❌ MISSING");
  console.log("BREVO_SMTP_PORT:", port ?? "❌ MISSING");
  console.log("BREVO_SMTP_LOGIN:", login ?? "❌ MISSING");
  console.log("BREVO_API_KEY:", apiKey ? `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}` : "❌ MISSING");
  console.log("BREVO_SENDER_EMAIL:", sender ?? "(not set, will use SMTP_LOGIN)");
  console.log("");

  if (!host || !login || !apiKey) {
    console.error("❌ Missing required environment variables. Aborting.");
    process.exit(1);
  }

  // 2. Create transporter with debug
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port ?? 587),
    secure: false,
    auth: {
      user: login,
      pass: apiKey,
    },
    logger: true,   // Enable SMTP protocol logging
    debug: true,     // Include SMTP traffic in logs
  });

  // 3. Verify SMTP connection
  console.log("\n--- Step 1: Verifying SMTP connection ---");
  try {
    const verified = await transporter.verify();
    console.log("✅ SMTP connection verified:", verified);
  } catch (err) {
    console.error("❌ SMTP connection FAILED:", err);
    console.error("\nPossible causes:");
    console.error("  - Wrong BREVO_SMTP_LOGIN or BREVO_API_KEY");
    console.error("  - BREVO_SMTP_SERVER/PORT is incorrect");
    console.error("  - Firewall blocking port 587");
    process.exit(1);
  }

  // 4. Send test email
  const fromAddr = `B.Duck Test <${sender ?? login}>`;
  const toAddr = login; // Send to self for testing

  console.log(`\n--- Step 2: Sending test email ---`);
  console.log(`From: ${fromAddr}`);
  console.log(`To: ${toAddr}`);

  try {
    const info = await transporter.sendMail({
      from: fromAddr,
      to: toAddr,
      subject: "🧪 B.Duck SMTP Test — " + new Date().toISOString(),
      text: "If you receive this email, SMTP is working correctly!",
      html: "<h2>✅ SMTP Working!</h2><p>B.Duck Cityfuns email system is operational.</p>",
    });

    console.log("\n✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);
    console.log("Envelope:", JSON.stringify(info.envelope));
  } catch (err) {
    console.error("\n❌ Failed to send test email:", err);
  }

  process.exit(0);
}

diagnose();
