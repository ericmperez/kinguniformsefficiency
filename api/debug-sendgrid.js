import sgMail from '@sendgrid/mail';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = {
      sendgridApiKeySet: !!process.env.SENDGRID_API_KEY,
      sendgridApiKeyLength: process.env.SENDGRID_API_KEY?.length || 0,
      emailUser: process.env.EMAIL_USER,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    };

    console.log('📧 SendGrid Debug Info:', config);

    return res.status(200).json({
      success: true,
      config
    });
  } catch (err) {
    console.error('Debug error:', err);
    return res.status(500).json({ 
      error: 'Debug failed', 
      details: err.message 
    });
  }
}
