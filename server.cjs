const express = require('express');
const nodemailer = require('nodemailer');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

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
    user: process.env.EMAIL_USER || 'notifications@kinguniforms.net',
    pass: process.env.EMAIL_PASSWORD || 'lvra prfc osfy lavc'
  }
});

app.post('/api/send-invoice', async (req, res) => {
  const { to, subject, text, pdfBase64, invoiceNumber } = req.body;
  if (!to || !pdfBase64) return res.status(400).json({ error: 'Missing data' });
  try {
    await transporter.sendMail({
      from: 'notifications@kinguniforms.net',
      to,
      subject,
      text,
      attachments: [
        {
          filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket.pdf',
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

// New endpoint for sending test emails (now supports PDF attachments)
app.post('/api/send-test-email', async (req, res) => {
  const { to, cc, subject, body, pdfBase64, invoiceNumber } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email is required' });
  
  try {
    const mailOptions = {
      from: 'notifications@kinguniforms.net',
      to,
      cc: cc || [],
      subject,
      text: body
    };

    // Add PDF attachment if provided
    if (pdfBase64) {
      mailOptions.attachments = [
        {
          filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket-test.pdf',
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf'
        }
      ];
    }

    await transporter.sendMail(mailOptions);
    console.log(`Test email sent successfully to ${to}${pdfBase64 ? ' with PDF attachment' : ''}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Test email send error:', err);
    res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
});

app.listen(3001, () => console.log('Backend listening on port 3001'));
