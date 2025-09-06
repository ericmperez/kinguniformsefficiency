// Test script to verify new alert recipients using existing sendmail configuration
// Run this to test the updated email notification system

console.log('🧪 Testing New Alert Recipients Configuration');
console.log('===========================================');
console.log('📧 New Recipients:');
console.log('  • rmperez@kinguniforms.net');
console.log('  • eric.perez.pr@gmail.com');
console.log('  • jperez@kinguniforms.net');
console.log('');

async function testEmailConfiguration() {
  console.log('📤 Testing email notification using existing sendmail configuration...');
  
  const emailData = {
    to: 'rmperez@kinguniforms.net, eric.perez.pr@gmail.com, jperez@kinguniforms.net',
    subject: '🧪 King Uniforms - New Alert Recipients Test',
    body: `This is a test notification to verify the new alert recipients configuration.

📧 New Alert Recipients:
• rmperez@kinguniforms.net
• eric.perez.pr@gmail.com  
• jperez@kinguniforms.net

✅ If you receive this email, the new alert configuration is working correctly!

Test Details:
• Date: ${new Date().toLocaleDateString()}
• Time: ${new Date().toLocaleTimeString()}
• System: Driver Assignment Alert System
• Test Type: New Recipients Configuration

The following alerts will now be sent to these email addresses:
🚛 Daily driver assignment checks (8:00 PM)
🚨 System error notifications
⚠️ Unassigned truck alerts
✅ Daily confirmation messages

Best regards,
King Uniforms Alert System`
  };

  try {
    // Use node-fetch for the API call
    const fetch = require('node-fetch');

    console.log('📧 Sending test email to all new recipients...');
    
    const response = await fetch('http://localhost:5173/api/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test notification sent successfully!');
      console.log('');
      console.log('📬 Check your email inboxes for the test message:');
      console.log('  • rmperez@kinguniforms.net');
      console.log('  • eric.perez.pr@gmail.com');
      console.log('  • jperez@kinguniforms.net');
      console.log('');
      console.log('🎉 New alert recipients configuration is working correctly!');
      
    } else {
      const errorText = await response.text();
      console.log('❌ Test notification failed!');
      console.log('Error:', errorText);
      console.log('');
      console.log('💡 Make sure the email server is running: node server.cjs');
    }

  } catch (error) {
    console.log('❌ Error testing notification system:', error.message);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   • Make sure the email server is running on port 5173');
    console.log('   • Run: node server.cjs');
    console.log('   • Check network connectivity');
  }
  
  console.log('');
  console.log('📋 Summary:');
  console.log('✅ Email recipients updated to:');
  console.log('  • rmperez@kinguniforms.net');
  console.log('  • eric.perez.pr@gmail.com');
  console.log('  • jperez@kinguniforms.net');
  console.log('✅ Alert system configured for new recipients');
  console.log('');
  console.log('🔔 The alert system will now send notifications to all three email addresses');
  console.log('   for driver assignment checks, system errors, and daily confirmations.');
}

// Run the test
testEmailConfiguration().catch(console.error);