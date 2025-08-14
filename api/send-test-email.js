import sgMail from '@sendgrid/mail';

// Configure SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY environment variable is not set');
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, cc, subject, body, pdfBase64, invoiceNumber } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }

  try {
    const emailOptions = {
      from: 'notifications@kinguniforms.net',
      to,
      cc: cc || [],
      subject,
      text: body
    };

    // Add PDF attachment if provided
    if (pdfBase64) {
      // Check PDF size
      const pdfSizeInMB = (pdfBase64.length * 0.75) / (1024 * 1024);
      console.log(`📄 PDF attachment size: ${pdfSizeInMB.toFixed(2)}MB`);
      
      if (pdfSizeInMB > 25) {
        // SendGrid limit is 30MB, but keeping 25MB for safety
        console.log(`⚠️ PDF too large (${pdfSizeInMB.toFixed(2)}MB), sending without attachment`);
        emailOptions.text = `${body}\n\nNote: The PDF attachment was too large to include in this email (${pdfSizeInMB.toFixed(2)}MB). Please contact us for alternative delivery options.`;
      } else {
        // Add PDF attachment
        emailOptions.attachments = [
          {
            filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket-test.pdf',
            content: pdfBase64,
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ];
        console.log(`📎 PDF attachment added (${pdfSizeInMB.toFixed(2)}MB)`);
      }
    }

    await sgMail.send(emailOptions);
    
    console.log(`Test email sent successfully to ${to}${pdfBase64 ? ' with PDF attachment' : ''}`);
    return res.status(200).json({ 
      success: true,
      pdfIncluded: !!pdfBase64 && (pdfBase64.length * 0.75) / (1024 * 1024) <= 25
    });
  } catch (err) {
    console.error('Test email send error:', err);
    console.error('SendGrid error details:', err.response?.body || err.message);
    
    // Check for SendGrid specific errors
    if (err.code === 401) {
      return res.status(500).json({ 
        error: 'SendGrid authentication failed', 
        details: 'Invalid API key or unauthorized access' 
      });
    }
    
    if (err.code === 413 || err.message?.includes('too large')) {
      return res.status(413).json({ 
        error: 'Email content too large', 
        details: 'Please reduce PDF size or use alternative delivery method' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to send test email', 
      details: err.message || 'Unknown SendGrid error' 
    });
  }
}
