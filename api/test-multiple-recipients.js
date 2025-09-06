// Test Multiple Recipients Email System
// This endpoint tests that emails are sent to multiple recipients correctly

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧪 Testing Multiple Recipients Email System...');
    
    // Test data
    const testRecipients = [
      'rmperez@kinguniforms.net',
      'eric.perez.pr@gmail.com', 
      'jperez@kinguniforms.net'
    ];
    
    // Test 1: Send as comma-separated string (current format)
    console.log('Test 1: Sending as comma-separated string...');
    const test1Response = await fetch(`${req.headers.origin || 'http://localhost:3001'}/api/send-test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: testRecipients.join(', '),
        subject: '🧪 King Uniforms - Multiple Recipients Test (Comma Format)',
        body: `This is a test to verify that emails are sent to multiple recipients correctly.

📧 Test Recipients:
• rmperez@kinguniforms.net
• eric.perez.pr@gmail.com  
• jperez@kinguniforms.net

✅ If each person receives this email individually, the multiple recipients feature is working correctly!

Test Details:
• Date: ${new Date().toLocaleDateString()}
• Time: ${new Date().toLocaleTimeString()}
• Format: Comma-separated string
• Recipients Count: ${testRecipients.length}

This test confirms that the King Uniforms alert system will send notifications to all configured email addresses.`
      }),
    });

    const test1Result = await test1Response.json();
    
    // Test 2: Send as array (alternative format)
    console.log('Test 2: Sending as array...');
    const test2Response = await fetch(`${req.headers.origin || 'http://localhost:3001'}/api/send-test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: testRecipients,
        subject: '🧪 King Uniforms - Multiple Recipients Test (Array Format)',
        body: `This is a test to verify that emails are sent to multiple recipients correctly.

📧 Test Recipients:
• rmperez@kinguniforms.net
• eric.perez.pr@gmail.com  
• jperez@kinguniforms.net

✅ If each person receives this email individually, the multiple recipients feature is working correctly!

Test Details:
• Date: ${new Date().toLocaleDateString()}
• Time: ${new Date().toLocaleTimeString()}
• Format: Array format
• Recipients Count: ${testRecipients.length}

This test confirms that the King Uniforms alert system will send notifications to all configured email addresses.`
      }),
    });

    const test2Result = await test2Response.json();
    
    return res.status(200).json({
      success: true,
      message: 'Multiple recipients email tests completed',
      tests: {
        commaFormat: {
          success: test1Result.success,
          recipients: test1Result.recipients || 0,
          recipientList: test1Result.recipientList || []
        },
        arrayFormat: {
          success: test2Result.success,
          recipients: test2Result.recipients || 0,
          recipientList: test2Result.recipientList || []
        }
      },
      recommendation: test1Result.success && test2Result.success 
        ? 'Both formats work! Each recipient should receive individual emails.' 
        : 'Some tests failed. Check email configuration and try again.'
    });
    
  } catch (error) {
    console.error('Multiple recipients test failed:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Multiple recipients test failed', 
      details: error.message 
    });
  }
}
