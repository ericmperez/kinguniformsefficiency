import sgMail from '@sendgrid/mail';

// Configure SendGrid
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

  const { to, cc, subject, text, pdfBase64, invoiceNumber } = req.body;
   
   if (!to) {
     return res.status(400).json({ error: 'Missing recipient email' });
   }

   // If no PDF provided or empty PDF, send simple email
   if (!pdfBase64 || pdfBase64.trim() === '') {
     try {
       console.log(`Sending simple email to: ${to}`);
       
       const msg = {
         to,
         cc,
         from: process.env.EMAIL_USER,
         subject,
         text
       };
       
       await sgMail.send(msg);
       
       console.log('Simple email sent successfully');
       return res.status(200).json({ success: true, simple: true });
     } catch (err) {
       console.error('Simple email error:', err);
       return res.status(500).json({ error: 'Failed to send simple email', details: err.message });
     }
   }

  // Log request size for debugging
  const requestSize = JSON.stringify(req.body).length;
  console.log(`Request body size: ${(requestSize / (1024 * 1024)).toFixed(2)}MB`);

  // Check PDF size (Vercel has payload limits)
  const pdfSizeInMB = (pdfBase64.length * 0.75) / (1024 * 1024); // Rough base64 to binary size
  console.log(`PDF size: ${pdfSizeInMB.toFixed(2)}MB`);
  
  // If PDF is too large, try to send without attachment
  if (pdfSizeInMB > 3) {
    console.log('PDF too large, sending fallback email without attachment');
    
    try {
      const fallbackText = `${text}\n\nNote: The PDF attachment was too large to include in this email (${pdfSizeInMB.toFixed(2)}MB). Please contact us for an alternative delivery method.`;
      
      const msg = {
        to,
        cc,
        from: process.env.EMAIL_USER,
        subject: `${subject} (No Attachment)`,
        text: fallbackText
      };
      
      await sgMail.send(msg);
      
      return res.status(200).json({ 
        success: true, 
        fallback: true,
        message: `Email sent without PDF attachment. PDF size (${pdfSizeInMB.toFixed(2)}MB) exceeded limit.`
      });
    } catch (fallbackErr) {
      console.error('Fallback email error:', fallbackErr);
      return res.status(500).json({ 
        error: 'Failed to send email', 
        details: `PDF too large (${pdfSizeInMB.toFixed(2)}MB) and fallback email failed: ${fallbackErr.message}` 
      });
    }
  }

  try {
    console.log(`Sending email to: ${to}`);
    
    const msg = {
      to,
      cc,
      from: process.env.EMAIL_USER,
      subject,
      text,
      attachments: [
        {
          filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket.pdf',
          content: pdfBase64,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };
    
    await sgMail.send(msg);
    
    console.log('Email sent successfully');
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    
    // Check if it's a 413 error from the provider
    if (err.responseCode === 413 || err.message.includes('too large')) {
      return res.status(413).json({ 
        error: 'Email content too large', 
        details: `PDF size: ${pdfSizeInMB.toFixed(2)}MB. Try reducing PDF size.`
      });
    }
    
    return res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
}
