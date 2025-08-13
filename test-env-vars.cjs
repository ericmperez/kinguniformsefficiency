// Test environment variables loading
require('dotenv').config({ path: '.env.local' });

console.log('🔧 Environment Variables Test');
console.log('============================');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET');
console.log('');

const nodemailer = require('nodemailer');

async function testWithEnvVars() {
  console.log('📧 Testing with environment variables...');
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  try {
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    console.log('📤 Sending test email...');
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'eric.perez.pr@gmail.com',
      subject: 'King Uniforms - Environment Variables Test',
      text: `Test email sent at ${new Date().toLocaleString()}

This email was sent using environment variables:
- From: ${process.env.EMAIL_USER}
- Time: ${new Date().toLocaleString()}

If you receive this, the email configuration is working!`
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📬 Check eric.perez.pr@gmail.com for the test message');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n💡 App Password issues:');
      console.log('• Generate a NEW App Password in Gmail');
      console.log('• Make sure 2-Step Verification is enabled');
      console.log('• Use "Mail" as the app type');
      console.log('• Copy the password exactly as shown');
    }
  }
}

testWithEnvVars().catch(console.error);
