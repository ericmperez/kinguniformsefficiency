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

  const { to, subject, text, pdfBase64, invoiceNumber } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Missing recipient email' });
  }

  console.log(`📧 Processing email request for: ${to}`);
  
  try {
    // If no PDF provided or empty PDF, send simple email
    if (!pdfBase64 || pdfBase64.trim() === '') {
      console.log('📧 Sending simple text email (no attachment)');
      
      const msg = {
        from: 'notifications@kinguniforms.net',
        to,
        subject,
        text
      };
      
      await sgMail.send(msg);
      
      console.log('✅ Simple email sent successfully');
      return res.status(200).json({ success: true, type: 'simple' });
    }

    // Check PDF size
    const pdfSizeInMB = (pdfBase64.length * 0.75) / (1024 * 1024);
    console.log(`📄 PDF size: ${pdfSizeInMB.toFixed(2)}MB`);

    // Attempt to send PDF directly with SendGrid
    console.log(`📧 Sending email with PDF attachment (${pdfSizeInMB.toFixed(2)}MB)`);
    
    const msg = {
      from: 'notifications@kinguniforms.net',
      to,
      subject,
      text,
      attachments: [
        {
          filename: invoiceNumber ? `delivery ticket #${invoiceNumber}.pdf` : 'delivery ticket.pdf',
          content: pdfBase64,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };
    
    await sgMail.send(msg);
    
    console.log('✅ Email with PDF attachment sent successfully');
    return res.status(200).json({ success: true, type: 'with_attachment' });
    
  } catch (err) {
    console.error('❌ Email send error:', err);
    
    // If it's a size-related error, try sending notification instead
    if (err.message.includes('too large') || err.message.includes('413') || err.responseCode === 413) {
      console.log('🔄 Retrying as notification email due to size error');
      
      try {
        const errorNotificationText = `${text}\n\n📎 DELIVERY CONFIRMATION NOTICE:\nWe encountered an issue sending your delivery confirmation PDF due to file size limitations.\n\nPlease contact King Uniforms to receive your delivery confirmation document:\n- Phone: [Your Phone Number]\n- Email: notifications@kinguniforms.net\n\nYour delivery has been completed successfully. This email serves as confirmation.\n\nBest regards,\nKing Uniforms Team`;
        
        const recoveryMsg = {
          from: 'notifications@kinguniforms.net',
          to,
          subject: `${subject} (Delivery Confirmed - PDF Available on Request)`,
          text: errorNotificationText
        };
        
        await sgMail.send(recoveryMsg);
        
        console.log('✅ Error recovery notification email sent');
        return res.status(200).json({ 
          success: true, 
          type: 'error_recovery',
          message: 'PDF attachment failed due to size, notification email sent instead'
        });
      } catch (recoveryErr) {
        console.error('❌ Recovery email also failed:', recoveryErr);
        return res.status(500).json({ 
          error: 'Failed to send email', 
          details: `Both attachment and notification emails failed: ${recoveryErr.message}` 
        });
      }
    }
    
    return res.status(500).json({ 
      error: 'Failed to send email', 
      details: err.message 
    });
  }
}
