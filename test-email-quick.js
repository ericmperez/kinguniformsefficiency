// Quick Email Test Script
// Tests the current email configuration to see if it's working

require('dotenv').config({ path: '.env.local' });

const nodemailer = require('nodemailer');

async function testEmailConfiguration() {
  console.log('🧪 Testing Email Configuration');
  console.log('==============================');
  
  // Get credentials from environment
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  
  console.log(`📧 Email User: ${emailUser}`);
  console.log(`🔑 Email Password: ${emailPassword ? '***configured***' : 'MISSING'}`);
  
  if (!emailUser || !emailPassword) {
    console.log('❌ Email credentials not configured properly');
    return;
  }
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPassword
    }
  });
  
  // Test connection
  console.log('\n🔌 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful');
  } catch (error) {
    console.log('❌ SMTP connection failed:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n💡 TROUBLESHOOTING:');
      console.log('• The password may have expired or changed');
      console.log('• Generate a new Gmail App Password:');
      console.log('  1. Go to Google Account settings');
      console.log('  2. Security → 2-Step Verification');
      console.log('  3. App passwords → Generate new password');
      console.log('  4. Update EMAIL_PASSWORD in .env.local');
    }
    return;
  }
  
  // Test sending email
  console.log('\n📤 Testing email sending...');
  try {
    const testEmail = {
      from: emailUser,
      to: emailUser, // Send to self for testing
      subject: 'King Uniforms Email Test - ' + new Date().toISOString(),
      text: `This is a test email sent at ${new Date().toLocaleString()}.

If you receive this email, your email configuration is working correctly!

Test Details:
- Sender: ${emailUser}
- Date: ${new Date().toLocaleString()}
- Server: Gmail SMTP

King Uniforms Email System Test`
    };
    
    await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`📬 Check ${emailUser} inbox for the test message`);
    
  } catch (error) {
    console.log('❌ Failed to send test email:', error.message);
    return;
  }
  
  console.log('\n🎉 Email configuration is working correctly!');
  console.log('If emails are still not sending from the app, the issue may be:');
  console.log('• Client email settings not configured properly');
  console.log('• Email service not being called correctly');
  console.log('• Production environment variables not updated');
}

// Run the test
testEmailConfiguration().catch(console.error);
