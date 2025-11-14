// src/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../config/db");
const { Resend } = require("resend");
require("dotenv").config();

// --- ENV ---
const BACKEND_BASE = (process.env.BASE_URL || "").replace(/\/+$/, "");
const FRONTEND_BASE = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL;

// For debugging at startup
console.log("[email] Using Resend API:", process.env.RESEND_API_KEY ? "LOADED" : "MISSING");
console.log("[email] From email:", FROM_EMAIL);

// Build verification link
function buildVerificationLink(token) {
  return `${BACKEND_BASE}/api/auth/verify?token=${token}`;
}

// ------------------------------------------------------
// REGISTER
// ------------------------------------------------------
exports.register = async (req, res) => {
  let { email, password } = req.body || {};
  console.log("[register] incoming body:", req.body);

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    email = String(email).trim().toLowerCase();

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await query("SELECT * FROM users WHERE email = $1", [email]);
    const existingUser = existing.rows[0];

    // ------------------------------------------------------
    // CASE 1: User exists and already verified
    // ------------------------------------------------------
    if (existingUser && existingUser.is_verified) {
      console.log("[register] user already verified:", email);
      return res.status(400).json({ message: "Email already registered." });
    }

    // ------------------------------------------------------
    // CASE 2: User exists but NOT verified → resend verification email
    // ------------------------------------------------------
    if (existingUser && !existingUser.is_verified) {
      console.log("[register] user exists but not verified:", email);

      let token = existingUser.verification_token;
      if (!token) {
        token = uuidv4();
        await query(
          `UPDATE users SET verification_token = $1, updated_at = NOW() WHERE id = $2`,
          [token, existingUser.id]
        );
      }

      const verifyURL = buildVerificationLink(token);

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: "Verify your Sparely email (reminder)",
          html: `
            <p>You began signing up for Sparely.</p>
            <p>Please verify your email:</p>
            <a href="${verifyURL}">Verify Email</a>
          `,
        });

        console.log("[register] reminder email sent:", email);
        return res.status(200).json({
          message: "Verification email already sent. Please check your inbox.",
        });
      } catch (mailErr) {
        console.error("[mail] resend error:", mailErr);
        return res.status(500).json({
          message: "Could not send verification email.",
          mailError: mailErr.message,
        });
      }
    }

    // ------------------------------------------------------
    // CASE 3: New user → create account + send verification email
    // ------------------------------------------------------
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    await query(
      `INSERT INTO users (email, password_hash, verification_token)
       VALUES ($1, $2, $3)`,
      [email, hashedPassword, verificationToken]
    );

    const verifyURL = buildVerificationLink(verificationToken);

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Verify your Sparely account",
        html: `
          <p>Welcome to Sparely!</p>
          <p>Verify your email to activate your account:</p>
          <a href="${verifyURL}">Verify Email</a>
        `,
      });

      console.log("[register] new user email sent:", email);
      return res.status(201).json({
        message: "User registered. Check your email to verify your account.",
      });
    } catch (mailErr) {
      console.error("[mail] resend error:", mailErr);
      return res.status(500).json({
        message: "Could not send verification email.",
        mailError: mailErr.message,
      });
    }
  } catch (err) {
    console.error("Register error:", err);
    return res
      .status(500)
      .json({ message: "Something went wrong during registration" });
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
       SET is_verified = TRUE,
           verification_token = NULL,
           updated_at = NOW()
       WHERE verification_token = $1
       RETURNING id, email`,
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

    email = String(email).trim().toLowerCase();

    const result = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    if (!user.is_verified)
      return res.status(401).json({ message: "Please verify your email" });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

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
