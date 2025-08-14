import nodemailer from 'nodemailer';

// Configure Nodemailer transporter with Gmail SMTP
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

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
      
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        text
      });
      
      console.log('✅ Simple email sent successfully');
      return res.status(200).json({ success: true, type: 'simple' });
    }

    // Check PDF size
    const pdfSizeInMB = (pdfBase64.length * 0.75) / (1024 * 1024);
    console.log(`📄 PDF size: ${pdfSizeInMB.toFixed(2)}MB`);

    // For extremely large PDFs (>8MB), send email with contact note instead of attachment
    if (pdfSizeInMB > 8) {
      console.log(`⚠️ PDF extremely large (${pdfSizeInMB.toFixed(2)}MB), sending contact notification email`);
      
      const notificationText = `${text}\n\n📎 LARGE DELIVERY CONFIRMATION NOTICE:\nYour delivery confirmation PDF (${pdfSizeInMB.toFixed(2)}MB) is too large to include as an email attachment due to email system limitations.\n\nPlease contact King Uniforms to receive your delivery confirmation document through an alternative method:\n- Phone: [Your Phone Number]\n- Email: notifications@kinguniforms.net\n- Visit us in person for a printed copy\n\nYour delivery has been completed successfully. This email serves as confirmation of delivery.\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nBest regards,\nKing Uniforms Team`;
      
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: `${subject} (Large Document - Contact for PDF)`,
        text: notificationText
      });
      
      console.log('✅ Large PDF notification email sent successfully');
      return res.status(200).json({ 
        success: true, 
        type: 'large_pdf_notification',
        message: `PDF was ${pdfSizeInMB.toFixed(2)}MB - notification email sent instead`
      });
    }

    // For large PDFs (4-8MB), try to send but with warning in email
    if (pdfSizeInMB > 4) {
      console.log(`⚠️ PDF large (${pdfSizeInMB.toFixed(2)}MB), sending with size warning`);
      
      const warningText = `${text}\n\n📎 Note: This delivery confirmation PDF is ${pdfSizeInMB.toFixed(2)}MB in size. The file has been compressed to reduce email delivery issues. If you have trouble downloading or viewing it, please contact us for assistance.`;
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject: `${subject} (Compressed PDF - ${pdfSizeInMB.toFixed(1)}MB)`,
          text: warningText,
          attachments: [
            {
              filename: invoiceNumber ? `delivery ticket #${invoiceNumber} (compressed).pdf` : 'delivery ticket (compressed).pdf',
              content: Buffer.from(pdfBase64, 'base64'),
              contentType: 'application/pdf'
            }
          ]
        });
        
        console.log('✅ Large PDF email with warning sent successfully');
        return res.status(200).json({ 
          success: true, 
          type: 'large_pdf_with_warning',
          message: `Large PDF (${pdfSizeInMB.toFixed(2)}MB) sent with warning`
        });
      } catch (largePdfError) {
        console.warn('⚠️ Large PDF attachment failed, sending notification instead');
        // Fall through to notification email
      }
    }

    // For smaller PDFs, send with attachment
    console.log(`📧 Sending email with PDF attachment (${pdfSizeInMB.toFixed(2)}MB)`);
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      attachments: [
        {
          filename: invoiceNumber ? `delivery ticket #${invoiceNumber}.pdf` : 'delivery ticket.pdf',
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf'
        }
      ]
    });
    
    console.log('✅ Email with PDF attachment sent successfully');
    return res.status(200).json({ success: true, type: 'with_attachment' });
    
  } catch (err) {
    console.error('❌ Email send error:', err);
    
    // If it's a size-related error, try sending notification instead
    if (err.message.includes('too large') || err.message.includes('413') || err.responseCode === 413) {
      console.log('🔄 Retrying as notification email due to size error');
      
      try {
        const errorNotificationText = `${text}\n\n📎 DELIVERY CONFIRMATION NOTICE:\nWe encountered an issue sending your delivery confirmation PDF due to file size limitations.\n\nPlease contact King Uniforms to receive your delivery confirmation document:\n- Phone: [Your Phone Number]\n- Email: notifications@kinguniforms.net\n\nYour delivery has been completed successfully. This email serves as confirmation.\n\nBest regards,\nKing Uniforms Team`;
        
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject: `${subject} (Delivery Confirmed - PDF Available on Request)`,
          text: errorNotificationText
        });
        
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
