/**
 * Send a REAL test email to the user's inbox.
 * Run: npx tsx src/lib/email/test-real.ts
 */
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testReal() {
  const host = process.env.BREVO_SMTP_SERVER!;
  const port = Number(process.env.BREVO_SMTP_PORT ?? 587);
  const login = process.env.BREVO_SMTP_LOGIN!;
  const apiKey = process.env.BREVO_API_KEY!;

  const transporter = nodemailer.createTransport({
    host, port,
    secure: false,
    auth: { user: login, pass: apiKey },
    logger: true,
    debug: true,
  });

  // Test 1: FROM = SMTP login (a82c67001@smtp-brevo.com)
  console.log("\n=== TEST 1: FROM = SMTP login address ===");
  try {
    const info1 = await transporter.sendMail({
      from: `B.Duck Test <${login}>`,
      to: "hoai.2274801030190@vanlanguni.vn",
      subject: "🧪 Test 1 — FROM=SMTP Login — " + new Date().toLocaleTimeString(),
      html: "<h2>Test 1</h2><p>FROM = SMTP login address<br/>Nếu bạn nhận được email này, cấu hình đang đúng.</p>",
    });
    console.log("✅ Test 1 accepted:", info1.response);
  } catch (err) {
    console.error("❌ Test 1 failed:", err);
  }

  // Test 2: FROM = user's email (requires it to be verified in Brevo)
  console.log("\n=== TEST 2: FROM = hoai email ===");
  try {
    const info2 = await transporter.sendMail({
      from: "B.Duck Cityfuns <hoai.2274801030190@vanlanguni.vn>",
      to: "hoai.2274801030190@vanlanguni.vn",
      subject: "🧪 Test 2 — FROM=User Email — " + new Date().toLocaleTimeString(),
      html: "<h2>Test 2</h2><p>FROM = hoai email (verified sender?)<br/>Check if this arrives.</p>",
    });
    console.log("✅ Test 2 accepted:", info2.response);
  } catch (err) {
    console.error("❌ Test 2 failed:", err);
  }

  console.log("\n=== DONE ===");
  console.log("Check your inbox at hoai.2274801030190@vanlanguni.vn");
  console.log("If neither arrives, you need to verify a sender in Brevo:");
  console.log("  → https://app.brevo.com/senders/list");
  console.log("  → Add your email as a verified sender");
  console.log("  → Then set BREVO_SENDER_EMAIL in .env.local");

  process.exit(0);
}

testReal();
