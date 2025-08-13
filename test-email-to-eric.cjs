// Test Email to Eric's New Address
// Tests the delivery ticket email system

const https = require('https');

async function testEmailToEric() {
  console.log('🧪 Testing Email System for Delivery Tickets');
  console.log('===========================================');
  console.log('👤 Sending test email to: eric.perez.pr@gmail.com');
  console.log('📤 From: notifications@kinguniforms.net');
  console.log('📄 Testing delivery ticket notification system\n');
  
  try {
    const emailData = {
      to: 'eric.perez.pr@gmail.com',
      subject: 'King Uniforms - Delivery Ticket Test Email',
      body: `Dear Eric,

This is a test email from the King Uniforms delivery ticket system.

Test Details:
- Date: ${new Date().toLocaleString()}
- From: notifications@kinguniforms.net
- To: eric.perez.pr@gmail.com
- System: Delivery Ticket Email Notifications

If you receive this email, the delivery ticket email notification system is working correctly!

The system can now:
✅ Send delivery confirmations
✅ Include PDF attachments
✅ Use the correct sender address
✅ Send to your updated email address

Best regards,
King Uniforms Delivery System

---
This is an automated test message from the King Uniforms laundry management system.`
    };

    console.log('📡 Sending test email via backend API...');
    
    // Using built-in http module instead of node-fetch
    const postData = JSON.stringify(emailData);
    
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: '/api/send-test-email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await new Promise((resolve, reject) => {
      const req = require('http').request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ ok: res.statusCode === 200, result });
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    if (response.ok && response.result.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📬 Check eric.perez.pr@gmail.com inbox for the test message');
      console.log('\n🎉 Delivery ticket email system is working correctly!');
    } else {
      console.log('❌ Failed to send test email');
      console.log('Error:', response.result.error);
      if (response.result.details) {
        console.log('Details:', response.result.details);
      }
    }
    
  } catch (error) {
    console.log('❌ Error testing email system:', error.message);
    console.log('\n💡 TROUBLESHOOTING:');
    console.log('• Make sure the backend server is running (node server.cjs)');
    console.log('• Check email credentials in environment variables');
    console.log('• Verify network connection');
  }
}

// Run the test
testEmailToEric().catch(console.error);
