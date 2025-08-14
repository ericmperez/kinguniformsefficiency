// Test production email API endpoint
async function testProductionEmailAPI() {
  console.log('🔧 Testing production email API...');
  
  const testPayload = {
    to: 'ericperez@kinguniforms.net',
    subject: 'Production API Test - ' + new Date().toISOString(),
    text: 'This is a test of the production email API.\n\nTimestamp: ' + new Date().toISOString(),
    pdfBase64: '' // Empty to trigger simple email mode
  };
  
  try {
    console.log('📧 Sending request to production API...');
    
    const response = await fetch('https://kinguniformsefficiency.vercel.app/api/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    const data = await response.text();
    console.log('📄 Response body:', data);
    
    if (response.ok) {
      console.log('✅ Production email API test successful');
      return { success: true, status: response.status, data };
    } else {
      console.log('❌ Production email API test failed');
      return { success: false, status: response.status, data };
    }
  } catch (error) {
    console.error('❌ API test error:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the test
testProductionEmailAPI()
  .then(result => {
    console.log('\n📊 Final Results:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test script error:', error);
    process.exit(1);
  });
