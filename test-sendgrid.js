const sgMail = require('@sendgrid/mail');
require('dotenv').config({ path: '.env.local' });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'eric.perez.pr@gmail.com', // Change to your email
  from: 'notifications@kinguniforms.net', // Change to your verified sender
  subject: 'SendGrid Test Email',
  text: 'Hello from SendGrid! This is a test email to verify the API key is working.',
  html: '<strong>Hello from SendGrid!</strong><br>This is a test email to verify the API key is working.',
};

sgMail
  .send(msg)
  .then(() => {
    console.log('✅ Test email sent successfully!');
  })
  .catch((error) => {
    console.error('❌ Error sending test email:', error);
    if (error.response) {
      console.error('Error details:', error.response.body);
    }
  });
