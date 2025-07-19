import nodemailer from 'nodemailer';

// Configure Nodemailer transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, cc, subject, body } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      cc: cc || [],
      subject,
      text: body
    });
    
    console.log(`Test email sent successfully to ${to}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Test email send error:', err);
    return res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
}
