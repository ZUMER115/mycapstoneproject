// src/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../config/db");
const { Resend } = require("resend");
require("dotenv").config();

// ------------------------------------------------------
// ENV
// ------------------------------------------------------
const BACKEND_BASE = (process.env.BASE_URL || "").replace(/\/+$/, "");
const FRONTEND_BASE = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

// Initialize Resend client
const resend = new Resend(RESEND_KEY);

// Logging for debugging on Render:
console.log("------------------------------------------------------");
console.log("[email] Using Resend:", RESEND_KEY ? "API Key Loaded" : "MISSING API KEY");
console.log("[email] FROM_EMAIL:", FROM_EMAIL || "MISSING");
console.log("[BASE_URL]:", BACKEND_BASE);
console.log("------------------------------------------------------");

if (!RESEND_KEY) {
  console.warn("[WARN] No RESEND_API_KEY found — emails WILL NOT SEND.");
}
if (!FROM_EMAIL) {
  console.warn("[WARN] No FROM_EMAIL found — emails WILL NOT SEND.");
}

// Build verification link
function buildVerificationLink(token) {
  return `${BACKEND_BASE}/api/auth/verify?token=${token}`;
}

// ------------------------------------------------------
// REGISTER
// ------------------------------------------------------
exports.register = async (req, res) => {
  let { email, password } = req.body || {};
  console.log("[register] Incoming:", req.body);

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    email = email.toLowerCase().trim();

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existing = await query("SELECT * FROM users WHERE email = $1", [email]);
    const existingUser = existing.rows[0];

    // ------------------------------------------------------
    // CASE 1 — User exists & verified
    // ------------------------------------------------------
    if (existingUser && existingUser.is_verified) {
      console.log("[register] User already verified:", email);
      return res.status(400).json({ message: "Email already registered." });
    }

    // ------------------------------------------------------
    // CASE 2 — User exists but NOT verified → resend email
    // ------------------------------------------------------
    if (existingUser && !existingUser.is_verified) {
      console.log("[register] User exists but not verified — resending email:", email);

      let token = existingUser.verification_token;

      if (!token) {
        token = uuidv4();
        await query(
          `UPDATE users SET verification_token=$1, updated_at=NOW() WHERE id=$2`,
          [token, existingUser.id]
        );
      }

      const verifyURL = buildVerificationLink(token);

      try {
        const result = await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: "Verify your Sparely email (reminder)",
          html: `
            <p>You previously started creating a Sparely account.</p>
            <p>Click below to verify your email:</p>
            <a href="${verifyURL}">Verify Email</a>
          `,
        });

        console.log("[register] Resend reminder sent:", result);
        return res.status(200).json({
          message: "Verification email already sent. Please check your inbox.",
        });
      } catch (mailErr) {
        console.error("[mail] Reminder error:", mailErr);
        return res.status(500).json({
          message: "Could not send verification email.",
          mailError: mailErr.message,
        });
      }
    }

    // ------------------------------------------------------
    // CASE 3 — New user → create row + send verification email
    // ------------------------------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    await query(
      `INSERT INTO users (email, password_hash, verification_token)
       VALUES ($1,$2,$3)`,
      [email, hashedPassword, verificationToken]
    );

    const verifyURL = buildVerificationLink(verificationToken);

    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Verify your Sparely account",
        html: `
          <p>Welcome to Sparely!</p>
          <p>Click below to verify your email:</p>
          <a href="${verifyURL}">Verify Email</a>
        `,
      });

      console.log("[register] New verification email sent:", result);
      return res.status(201).json({
        message: "User registered. Check your email to verify your account.",
      });
    } catch (mailErr) {
      console.error("[mail] Failed sending new verification:", mailErr);
      return res.status(500).json({
        message: "Could not send verification email.",
        mailError: mailErr.message,
      });
    }
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Something went wrong during registration" });
  }
};

// ------------------------------------------------------
// VERIFY EMAIL
// ------------------------------------------------------
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) return res.status(400).send("Missing token");

  try {
    const result = await query(
      `UPDATE users
       SET is_verified=TRUE,
           verification_token=NULL,
           updated_at=NOW()
       WHERE verification_token=$1
       RETURNING id,email`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).send("Invalid or expired verification link.");
    }

    return res.send("Email successfully verified. You may now log in.");
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).send("Server error verifying email");
  }
};

// ------------------------------------------------------
// LOGIN
// ------------------------------------------------------
exports.login = async (req, res) => {
  let { email, password } = req.body || {};

  try {
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    email = email.toLowerCase().trim();

    const result = await query("SELECT * FROM users WHERE email=$1", [email]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    if (!user.is_verified)
      return res.status(401).json({ message: "Please verify your email" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login error" });
  }
};
