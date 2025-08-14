#!/usr/bin/env node

/**
 * SendGrid Production Diagnosis
 * Tests SendGrid configuration and email sending in production
 */

const https = require('https');

const PRODUCTION_URL = 'https://kinguniformsefficiency-i5vusxs77-erics-projects-eada5838.vercel.app';

function makeRequest(endpoint, data, method = 'POST') {
  return new Promise((resolve, reject) => {
    const postData = method === 'POST' ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'kinguniformsefficiency-i5vusxs77-erics-projects-eada5838.vercel.app',
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function diagnosePDFEmailIssues() {
  console.log('🔍 SendGrid PDF Email Diagnosis');
  console.log('=' .repeat(50));
  console.log(`🌐 Testing: ${PRODUCTION_URL}`);
  
  try {
    // Test 1: Check SendGrid configuration
    console.log('\n📧 Test 1: SendGrid Configuration Check');
    try {
      const configResult = await makeRequest('/api/debug-sendgrid', null, 'GET');
      console.log(`Status: ${configResult.status}`);
      
      if (configResult.status === 200) {
        console.log('✅ Debug endpoint accessible');
        console.log('Config:', JSON.stringify(configResult.data, null, 2));
      } else {
        console.log('❌ Debug endpoint failed');
        console.log('Response:', configResult.data);
      }
    } catch (error) {
      console.log('❌ Could not access debug endpoint:', error.message);
    }
    
    // Test 2: Simple email test (no PDF)
    console.log('\n📧 Test 2: Simple Email (No PDF)');
    const simpleEmailData = {
      to: 'test@example.com',
      subject: 'SendGrid Test - Simple Email',
      body: 'This is a simple test email to verify SendGrid is working.'
    };
    
    try {
      const emailResult = await makeRequest('/api/send-test-email', simpleEmailData);
      console.log(`Status: ${emailResult.status}`);
      console.log('Response:', JSON.stringify(emailResult.data, null, 2));
      
      if (emailResult.status === 200) {
        console.log('✅ Simple email test: SUCCESS');
      } else {
        console.log('❌ Simple email test: FAILED');
        console.log('This indicates a SendGrid configuration issue');
      }
    } catch (error) {
      console.log('❌ Simple email test error:', error.message);
    }
    
    // Test 3: Small PDF email test
    console.log('\n📧 Test 3: Small PDF Email');
    // Create a small base64 PDF (simulated)
    const smallPdfData = Buffer.from('Small PDF content for testing').toString('base64');
    
    const pdfEmailData = {
      to: 'test@example.com',
      subject: 'SendGrid Test - Small PDF',
      text: 'This is a test email with a small PDF attachment.',
      pdfBase64: smallPdfData,
      invoiceNumber: 'TEST001'
    };
    
    try {
      const pdfResult = await makeRequest('/api/send-invoice', pdfEmailData);
      console.log(`Status: ${pdfResult.status}`);
      console.log('Response:', JSON.stringify(pdfResult.data, null, 2));
      
      if (pdfResult.status === 200) {
        console.log('✅ Small PDF email test: SUCCESS');
      } else {
        console.log('❌ Small PDF email test: FAILED');
      }
    } catch (error) {
      console.log('❌ Small PDF email test error:', error.message);
    }
    
    // Test 4: Check FROM email configuration
    console.log('\n📧 Test 4: FROM Email Configuration');
    console.log('Expected FROM email: process.env.EMAIL_USER');
    console.log('Note: SendGrid requires verified sender addresses');
    console.log('Check SendGrid dashboard for sender verification status');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎯 DIAGNOSIS COMPLETE');
  console.log('\n💡 Common Issues & Solutions:');
  console.log('1. Unauthorized (401): Invalid SendGrid API key');
  console.log('2. Forbidden (403): Sender email not verified in SendGrid');
  console.log('3. Internal Error (500): Code configuration issue');
  console.log('4. PDF issues: Check PDF size and base64 encoding');
  console.log('\n📞 Next Steps:');
  console.log('- Check SendGrid dashboard for sender verification');
  console.log('- Verify API key has Send Email permissions');
  console.log('- Check Vercel function logs for detailed errors');
}

diagnosePDFEmailIssues();
