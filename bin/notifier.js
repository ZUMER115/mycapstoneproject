const nodemailer = require('nodemailer');
require('dotenv').config();

// Hardcoded test user and deadline
const testUser = {
  email: 'zackbozz1@gmail.com', // replace with your actual email
  is_verified: true
};

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 4);

const deadlines = [
  {
    event: 'Fake Test Deadline',
    date: tomorrow,
    user: testUser
  }
];

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function notifyUpcomingDeadlines() {
  const today = new Date();

  for (const deadline of deadlines) {
    const diffTime = new Date(deadline.date) - today;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays >= 0 && diffDays <= 3 && deadline.user.is_verified) {
      const mailOptions = {
        from: `"Sparely Notifier" <${process.env.EMAIL_USER}>`,
        to: deadline.user.email,
        subject: `Upcoming Deadline: ${deadline.event}`,
        html: `<p><strong>${deadline.event}</strong> is due on <strong>${new Date(deadline.date).toDateString()}</strong>. Make sure you're ready!</p>`
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${deadline.user.email}`);
      } catch (err) {
        console.error('Error sending email:', err);
      }
    }
  }
}

notifyUpcomingDeadlines();
