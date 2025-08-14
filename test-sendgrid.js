import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configure SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY environment variable is not set');
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'eric.perez.pr@gmail.com', // Change to your email
  from: process.env.EMAIL_USER || 'notifications@kinguniforms.net',
  subject: 'SendGrid Test Email - ' + new Date().toLocaleString(),
  text: 'This is a test email to verify SendGrid configuration is working correctly.\n\nIf you receive this email, SendGrid is properly configured!\n\nTimestamp: ' + new Date().toISOString(),
  html: `
    <h2>SendGrid Test Email</h2>
    <p>This is a test email to verify SendGrid configuration is working correctly.</p>
    <p><strong>If you receive this email, SendGrid is properly configured!</strong></p>
    <p><small>Timestamp: ${new Date().toISOString()}</small></p>
  `
};

console.log('🧪 Testing SendGrid API configuration...');
console.log('📧 Sending test email...');

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Test email sent successfully!');
    console.log(`📬 Check ${msg.to} for the test email`);
  })
  .catch((error) => {
    console.error('❌ Error sending test email:', error);
    if (error.response) {
      console.error('Error details:', error.response.body);
    }
  });
