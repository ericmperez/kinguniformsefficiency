/**
 * Email Configuration Test Script
 * Tests all email endpoints and configurations to verify production email functionality
 */

const testEmailConfiguration = async () => {
  console.log('🧪 Email Configuration Test Suite');
  console.log('=====================================\n');

  const results = {
    localServer: { passed: 0, failed: 0, tests: [] },
    apiEndpoints: { passed: 0, failed: 0, tests: [] },
    configuration: { passed: 0, failed: 0, tests: [] }
  };

  // Test 1: Local Server Email Endpoint
  console.log('📧 Testing Local Server Email Endpoints...');
  
  try {
    // Test send-test-email endpoint
    const testEmailResponse = await fetch('http://localhost:5173/api/send-test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'emperez@kinguniforms.net',
        subject: 'Test Email - Local Server',
        body: 'This is a test email from the local server.'
      })
    });

    const testEmailResult = await testEmailResponse.json();
    
    if (testEmailResponse.ok && testEmailResult.success) {
      console.log('✅ Local server test email endpoint: WORKING');
      results.localServer.passed++;
      results.localServer.tests.push('Test email endpoint - PASSED');
    } else {
      console.log('❌ Local server test email endpoint: FAILED');
      console.log('   Error:', testEmailResult.error || 'Unknown error');
      results.localServer.failed++;
      results.localServer.tests.push('Test email endpoint - FAILED');
    }
  } catch (error) {
    console.log('❌ Local server test email endpoint: CONNECTION FAILED');
    console.log('   Error:', error.message);
    results.localServer.failed++;
    results.localServer.tests.push('Test email endpoint - CONNECTION FAILED');
  }

  try {
    // Test send-invoice endpoint
    const invoiceEmailResponse = await fetch('http://localhost:5173/api/send-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'emperez@kinguniforms.net',
        subject: 'Test Invoice - Local Server',
        text: 'This is a test invoice email.',
        pdfBase64: 'VGVzdCBQREYgY29udGVudA==' // Base64 for "Test PDF content"
      })
    });

    const invoiceEmailResult = await invoiceEmailResponse.json();
    
    if (invoiceEmailResponse.ok && invoiceEmailResult.success) {
      console.log('✅ Local server invoice email endpoint: WORKING');
      results.localServer.passed++;
      results.localServer.tests.push('Invoice email endpoint - PASSED');
    } else {
      console.log('❌ Local server invoice email endpoint: FAILED');
      console.log('   Error:', invoiceEmailResult.error || 'Unknown error');
      results.localServer.failed++;
      results.localServer.tests.push('Invoice email endpoint - FAILED');
    }
  } catch (error) {
    console.log('❌ Local server invoice email endpoint: CONNECTION FAILED');
    console.log('   Error:', error.message);
    results.localServer.failed++;
    results.localServer.tests.push('Invoice email endpoint - CONNECTION FAILED');
  }

  console.log('\n📋 Testing Configuration Files...');

  // Test 2: Configuration Files
  const fs = await import('fs/promises');
  
  try {
    // Check vercel.json
    const vercelConfig = JSON.parse(await fs.readFile('./vercel.json', 'utf8'));
    
    if (vercelConfig.env && vercelConfig.env.EMAIL_USER && vercelConfig.env.EMAIL_PASSWORD) {
      console.log('✅ vercel.json email environment variables: CONFIGURED');
      results.configuration.passed++;
      results.configuration.tests.push('vercel.json env vars - CONFIGURED');
    } else {
      console.log('❌ vercel.json email environment variables: MISSING');
      results.configuration.failed++;
      results.configuration.tests.push('vercel.json env vars - MISSING');
    }
  } catch (error) {
    console.log('❌ vercel.json configuration: ERROR');
    console.log('   Error:', error.message);
    results.configuration.failed++;
    results.configuration.tests.push('vercel.json config - ERROR');
  }

  try {
    // Check API files
    const sendInvoiceCode = await fs.readFile('./api/send-invoice.js', 'utf8');
    const sendTestCode = await fs.readFile('./api/send-test-email.js', 'utf8');
    
    const hasEnvVars = sendInvoiceCode.includes('process.env.EMAIL_USER') && 
                      sendInvoiceCode.includes('process.env.EMAIL_PASSWORD') &&
                      sendTestCode.includes('process.env.EMAIL_USER') && 
                      sendTestCode.includes('process.env.EMAIL_PASSWORD');
    
    if (hasEnvVars) {
      console.log('✅ API files use environment variables: CORRECT');
      results.configuration.passed++;
      results.configuration.tests.push('API env var usage - CORRECT');
    } else {
      console.log('❌ API files use environment variables: INCORRECT');
      results.configuration.failed++;
      results.configuration.tests.push('API env var usage - INCORRECT');
    }
  } catch (error) {
    console.log('❌ API files configuration: ERROR');
    console.log('   Error:', error.message);
    results.configuration.failed++;
    results.configuration.tests.push('API files config - ERROR');
  }

  // Test 3: Email Service Configuration
  console.log('\n⚙️ Testing Email Service Configuration...');
  
  try {
    const emailServiceCode = await fs.readFile('./src/services/emailService.ts', 'utf8');
    
    // Check if email service uses correct API endpoints
    const hasCorrectEndpoints = emailServiceCode.includes('/api/send-invoice') && 
                                emailServiceCode.includes('/api/send-test-email');
    
    if (hasCorrectEndpoints) {
      console.log('✅ Email service API endpoints: CORRECT');
      results.apiEndpoints.passed++;
      results.apiEndpoints.tests.push('Email service endpoints - CORRECT');
    } else {
      console.log('❌ Email service API endpoints: INCORRECT');
      results.apiEndpoints.failed++;
      results.apiEndpoints.tests.push('Email service endpoints - INCORRECT');
    }
  } catch (error) {
    console.log('❌ Email service configuration: ERROR');
    console.log('   Error:', error.message);
    results.apiEndpoints.failed++;
    results.apiEndpoints.tests.push('Email service config - ERROR');
  }

  // Print Summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  
  const totalPassed = results.localServer.passed + results.apiEndpoints.passed + results.configuration.passed;
  const totalFailed = results.localServer.failed + results.apiEndpoints.failed + results.configuration.failed;
  const totalTests = totalPassed + totalFailed;
  
  console.log(`\n🏆 Overall Results: ${totalPassed}/${totalTests} tests passed`);
  
  console.log('\n📋 Detailed Results:');
  console.log('Local Server Tests:', results.localServer.passed, 'passed,', results.localServer.failed, 'failed');
  results.localServer.tests.forEach(test => console.log('  -', test));
  
  console.log('API Endpoint Tests:', results.apiEndpoints.passed, 'passed,', results.apiEndpoints.failed, 'failed');
  results.apiEndpoints.tests.forEach(test => console.log('  -', test));
  
  console.log('Configuration Tests:', results.configuration.passed, 'passed,', results.configuration.failed, 'failed');
  results.configuration.tests.forEach(test => console.log('  -', test));

  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Email configuration is ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above before deploying to production.');
  }

  return { totalPassed, totalFailed, totalTests, results };
};

// Run the test if this file is executed directly
testEmailConfiguration().catch(console.error);

export { testEmailConfiguration };
