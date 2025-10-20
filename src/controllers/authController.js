// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.register = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

await query(
  'INSERT INTO users (email, password_hash, verification_token) VALUES ($1, $2, $3)',
  [email, hashedPassword, verificationToken]
);


    const verifyURL = `${process.env.BASE_URL}/api/auth/verify?token=${verificationToken}`;

    await transporter.sendMail({
      from: `"Sparely" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email',
      html: `<p>Click to verify: <a href="${verifyURL}">${verifyURL}</a></p>`
    });

    res.status(201).json({ message: 'User registered. Please check your email to verify.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const result = await query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING *',
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).send('Invalid or expired token');
    }

    res.send('Email successfully verified! You may now log in.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error verifying email');
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);

    const user = result.rows[0];

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (!user.is_verified) return res.status(401).json({ message: 'Please verify your email' });

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login error' });
  }
};
