const// Configure Nodemailer transporter with Gmail SMTP
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emperez@kinguniforms.net',
    pass: process.env.EMAIL_PASSWORD || 'jbqp sxah ctff glku'
  }
}); = require('express');
const nodemailer = require('nodemailer');
const app = express();
app.use(express.json({ limit: '10mb' }));

// Configure Nodemailer transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emperez@kinguniforms.net',
    pass: process.env.EMAIL_PASSWORD || 'jbqp sxah ctff glku'
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
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

app.listen(5173, () => console.log('Backend listening on port 5173'));
