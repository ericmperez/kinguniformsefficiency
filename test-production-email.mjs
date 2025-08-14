import nodemailer from 'nodemailer';

// Test script to verify email functionality in production
async function testEmailInProduction() {
  console.log('🔧 Testing email configuration in production...');
  
  try {
    // Test 1: Create transporter with current config
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: 'notifications@kinguniforms.net',
        pass: 'lvra prfc osfy lavc'
      }
    });
    
    console.log('✅ Transporter created successfully');
    
    // Test 2: Verify transporter
    await transporter.verify();
    console.log('✅ Transporter verification successful');
    
    // Test 3: Send test email
    const testEmail = {
      from: 'notifications@kinguniforms.net',
      to: 'ericperez@kinguniforms.net',
      subject: 'Production Email Test - ' + new Date().toISOString(),
      text: 'This is a test email to verify production email functionality is working.\n\nTimestamp: ' + new Date().toISOString()
    };
    
    console.log('📧 Sending test email...');
    const result = await transporter.sendMail(testEmail);
    console.log('✅ Email sent successfully:', result.messageId);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the test
testEmailInProduction()
  .then(result => {
    console.log('\n📊 Test Results:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test script error:', error);
    process.exit(1);
  });
