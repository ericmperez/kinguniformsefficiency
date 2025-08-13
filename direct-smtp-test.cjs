// Direct SMTP Test for Gmail App Password
const nodemailer = require('nodemailer');

async function testDirectSMTP() {
  console.log('🔌 Direct SMTP Connection Test');
  console.log('=============================\n');
  
  // Test with the App Password as provided
  const appPassword = 'lvraprcfosfylavc';
  console.log(`📧 Testing with: notifications@kinguniforms.net`);
  console.log(`🔑 App Password: ${appPassword}\n`);
  
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: 'notifications@kinguniforms.net',
      pass: appPassword
    }
  });
  
  try {
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    console.log('\n📤 Sending test email...');
    await transporter.sendMail({
      from: 'notifications@kinguniforms.net',
      to: 'eric.perez.pr@gmail.com',
      subject: 'King Uniforms - Direct SMTP Test',
      text: 'This is a direct SMTP test. If you receive this, the Gmail App Password is working correctly!'
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📬 Check eric.perez.pr@gmail.com for the test message');
    
  } catch (error) {
    console.log('❌ SMTP Test Failed:');
    console.log('Error:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n💡 TROUBLESHOOTING:');
      console.log('• The App Password may be incorrect');
      console.log('• Try regenerating the App Password');
      console.log('• Make sure you\'re signed into notifications@kinguniforms.net when generating');
      console.log('• App Password format should be: "xxxx xxxx xxxx xxxx" (with spaces)');
    }
  }
}

testDirectSMTP().catch(console.error);
