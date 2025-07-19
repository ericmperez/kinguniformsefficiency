const express = require('express');
const nodemailer = require('nodemailer');
const app = express();

// Add CORS support to allow requests from our frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Configure Nodemailer transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'emperez@kinguniforms.net',
    pass: 'jbqp sxah ctff glku'
  }
});

app.post('/api/send-invoice', async (req, res) => {
  const { to, subject, text, pdfBase64 } = req.body;
  if (!to || !pdfBase64) return res.status(400).json({ error: 'Missing data' });
  try {
    await transporter.sendMail({
      from: 'emperez@kinguniforms.net',
      to,
      subject,
      text,
      attachments: [
        {
          filename: 'invoice.pdf',
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf'
        }
      ]
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message, full: err });
  }
});

// New endpoint for sending test emails
app.post('/api/send-test-email', async (req, res) => {
  const { to, cc, subject, body } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email is required' });
  
  try {
    await transporter.sendMail({
      from: 'emperez@kinguniforms.net',
      to,
      cc: cc || [],
      subject,
      text: body
    });
    console.log(`Test email sent successfully to ${to}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Test email send error:', err);
    res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
});

app.listen(5173, () => console.log('Backend listening on port 5173'));
