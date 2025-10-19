// src/utils/mailer.js

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Or your preferred provider
  auth: {
    user: process.env.EMAIL_USER,     // Add to .env
    pass: process.env.EMAIL_PASS      // Add to .env
  }
});

const sendVerificationEmail = async (email, token) => {
  const url = `http://localhost:3000/verify?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your email',
    html: `<p>Click the link to verify your email:</p><a href="${url}">${url}</a>`
  });
};

module.exports = { sendVerificationEmail };
