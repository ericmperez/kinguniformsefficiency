const express = require('express');
const sgMail = require('@sendgrid/mail');

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

app.use(express.json({ limit: '30mb' })); // Increased limit to 30mb for large PDF attachments

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/api/send-invoice', async (req, res) => {
  const { to, subject, text, pdfBase64, invoiceNumber } = req.body;
  if (!to || !pdfBase64) return res.status(400).json({ error: 'Missing data' });
  const msg = {
    to,
    from: 'notifications@kinguniforms.net',
    subject,
    text,
    attachments: [
      {
        content: pdfBase64,
        filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket.pdf',
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };
  try {
    await sgMail.send(msg);
    res.json({ success: true });
  } catch (err) {
    console.error('SendGrid email error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

// New endpoint for sending test emails (now supports PDF attachments)
app.post('/api/send-test-email', async (req, res) => {
  const { to, cc, subject, body, pdfBase64, invoiceNumber } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email is required' });
  
  try {
    const msg = {
      to,
      from: 'notifications@kinguniforms.net',
      cc: cc || [],
      subject,
      text: body
    };

    // Add PDF attachment if provided
    if (pdfBase64) {
      msg.attachments = [
        {
          content: pdfBase64,
          filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket-test.pdf',
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ];
    }

    await sgMail.send(msg);
    console.log(`Test email sent successfully to ${to}${pdfBase64 ? ' with PDF attachment' : ''}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Test email send error:', err);
    res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
});

app.listen(3001, () => console.log('Backend listening on port 3001'));
