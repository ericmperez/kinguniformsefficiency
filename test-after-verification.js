#!/usr/bin/env node

/**
 * Test SendGrid After Verification
 * Run this after verifying your sender email in SendGrid
 */

const https = require('https');

console.log('🧪 Testing SendGrid After Sender Verification');
console.log('=' .repeat(50));

const testData = {
  to: 'test@example.com', // Change this to a real email for testing
  subject: 'SendGrid Verification Test',
  body: 'This email tests if SendGrid sender verification is working.'
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'kinguniformsefficiency-i5vusxs77-erics-projects-eada5838.vercel.app',
  path: '/api/send-test-email',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📧 Sending test email via SendGrid...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`📊 Status: ${res.statusCode}`);
    
    try {
      const response = JSON.parse(body);
      console.log('📄 Response:', JSON.stringify(response, null, 2));
      
      if (res.statusCode === 200) {
        console.log('✅ SUCCESS! SendGrid is now working');
        console.log('✅ PDF emails should now send successfully');
      } else if (res.statusCode === 403 || res.statusCode === 401) {
        console.log('❌ STILL UNAUTHORIZED - Check sender verification');
        console.log('💡 Make sure you clicked the verification link in your email');
      } else {
        console.log('❌ Other issue detected - check response details');
      }
    } catch (error) {
      console.log('📄 Raw response:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.write(postData);
req.end();

console.log('\n💡 If this still fails after sender verification:');
console.log('1. Check that the correct email was verified');
console.log('2. Wait a few minutes for verification to propagate');
console.log('3. Check SendGrid dashboard for any error logs');
console.log('4. Ensure your SendGrid API key has "Mail Send" permissions');
