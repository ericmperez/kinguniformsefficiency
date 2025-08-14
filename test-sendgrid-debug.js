#!/usr/bin/env node

/**
 * SendGrid Debug Test for Production
 * Tests the SendGrid configuration in production environment
 */

const https = require('https');

const PRODUCTION_HOST = 'kinguniformsefficiency-i5vusxs77-erics-projects-eada5838.vercel.app';

function testSendGridDebug() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PRODUCTION_HOST,
      path: '/api/debug-sendgrid',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

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

    req.end();
  });
}

async function runDebugTest() {
  console.log('🔍 Testing SendGrid Configuration in Production');
  console.log('=' .repeat(50));
  
  try {
    const result = await testSendGridDebug();
    
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    
    if (result.status === 200) {
      if (result.data.sendgridConfigured) {
        console.log('✅ SendGrid is properly configured!');
        console.log(`✅ API Key present: ${result.data.apiKeyPresent}`);
        console.log(`✅ API Key format: ${result.data.apiKeyFormat}`);
        
        if (result.data.verifiedSender) {
          console.log(`✅ Verified sender: ${result.data.verifiedSender}`);
        } else {
          console.log('⚠️  No verified sender found - this may cause authorization issues');
        }
      } else {
        console.log('❌ SendGrid configuration issue detected');
        console.log('Issues:', result.data.issues);
      }
    } else {
      console.log('❌ Failed to check SendGrid configuration');
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  }
  
  console.log('\n' + '=' .repeat(50));
}

runDebugTest();
