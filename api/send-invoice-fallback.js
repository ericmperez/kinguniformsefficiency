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

  const { to, subject, text } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Missing recipient email' });
  }

  try {
    console.log(`Sending fallback email to: ${to}`);
    
    const fallbackText = `${text}\n\nNote: The PDF attachment was too large to include in this email. Please contact us for an alternative delivery method.`;
    
    const msg = {
      from: process.env.EMAIL_USER,
      to,
      subject: `${subject} (No Attachment)`,
      text: fallbackText
    };
    
    await sgMail.send(msg);
    
    console.log('Fallback email sent successfully');
    return res.status(200).json({ 
      success: true, 
      fallback: true,
      message: 'Email sent without PDF attachment due to size constraints'
    });
  } catch (err) {
    console.error('Fallback email send error:', err);
    return res.status(500).json({ error: 'Failed to send fallback email', details: err.message });
  }
}
