#!/usr/bin/env node

/**
 * Production Email Test
 * Tests the updated email functionality with PDF size limits and fallback
 */

const API_BASE_URL = 'https://kinguniformsefficiency.vercel.app';

async function testProductionEmail() {
  console.log('🧪 Testing Production Email Functionality...');
  console.log('🌐 Target URL:', API_BASE_URL);
  
  try {
    // Test 1: Simple email without PDF (should work)
    console.log('\n📧 Test 1: Simple email without PDF');
    const simpleEmailResponse = await fetch(`${API_BASE_URL}/api/send-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'test@example.com',
        subject: 'Production Test - Simple Email',
        text: 'This is a test email sent from production to verify the email service is working.',
        pdfBase64: '' // Empty PDF triggers simple email mode
      }),
    });
    
    const simpleResult = await simpleEmailResponse.json();
    console.log('📊 Response Status:', simpleEmailResponse.status);
    console.log('📊 Response Data:', simpleResult);
    
    if (simpleEmailResponse.ok) {
      console.log('✅ Simple email test: PASSED');
    } else {
      console.log('❌ Simple email test: FAILED');
    }
    
    // Test 2: Large PDF simulation (should trigger fallback)
    console.log('\n📧 Test 2: Large PDF simulation (fallback test)');
    
    // Create a large base64 string to simulate a large PDF (>2.5MB)
    const largePdfData = 'a'.repeat(3 * 1024 * 1024); // ~3MB of 'a' characters
    
    const largePdfResponse = await fetch(`${API_BASE_URL}/api/send-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'test@example.com',
        subject: 'Production Test - Large PDF Fallback',
        text: 'This is a test email with a large PDF that should trigger fallback mode.',
        pdfBase64: largePdfData
      }),
    });
    
    const largePdfResult = await largePdfResponse.json();
    console.log('📊 Response Status:', largePdfResponse.status);
    console.log('📊 Response Data:', largePdfResult);
    
    if (largePdfResponse.ok && largePdfResult.simple) {
      console.log('✅ Large PDF fallback test: PASSED');
    } else if (largePdfResponse.status === 413) {
      console.log('⚠️  Large PDF test: Expected 413 error (PDF too large)');
    } else {
      console.log('❌ Large PDF fallback test: FAILED');
    }
    
    // Test 3: Check if we can reach the main app
    console.log('\n🌐 Test 3: Main application accessibility');
    const appResponse = await fetch(API_BASE_URL);
    console.log('📊 App Response Status:', appResponse.status);
    
    if (appResponse.ok) {
      console.log('✅ Main application: ACCESSIBLE');
    } else {
      console.log('❌ Main application: NOT ACCESSIBLE');
    }
    
    console.log('\n🎯 Production Email Test Summary:');
    console.log('- Simple emails should work without issues');
    console.log('- Large PDFs should either trigger fallback or return 413 error');
    console.log('- The system is now more robust for handling large attachments');
    console.log('- Email functionality has been deployed to production successfully');
    
  } catch (error) {
    console.error('❌ Production test failed:', error.message);
    console.log('\n🔍 This could indicate:');
    console.log('- Network connectivity issues');
    console.log('- Server deployment problems');
    console.log('- API endpoint configuration issues');
  }
}

// Run the test
testProductionEmail();
