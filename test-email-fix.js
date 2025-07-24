// Test script to verify email API endpoints are working
const testEmailEndpoints = async () => {
  console.log('🧪 Testing email API endpoints...\n');

  // Test 1: Test email endpoint
  console.log('1. Testing /api/send-test-email endpoint...');
  try {
    const response = await fetch('http://localhost:5173/api/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'test@example.com',
        subject: 'Test Email from Fixed API',
        body: 'This is a test email to verify the API endpoint is working correctly.'
      }),
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, data);
    
    if (response.ok) {
      console.log('   ✅ Test email endpoint is working!\n');
    } else {
      console.log('   ❌ Test email endpoint failed\n');
    }
  } catch (error) {
    console.log('   ❌ Error connecting to test email endpoint:', error.message, '\n');
  }

  // Test 2: Invoice email endpoint (without sending actual email)
  console.log('2. Testing /api/send-invoice endpoint structure...');
  try {
    const response = await fetch('http://localhost:5173/api/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'test@example.com',
        subject: 'Test Invoice',
        text: 'Test invoice email',
        // Missing pdfBase64 intentionally to test validation
      }),
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, data);
    
    if (response.status === 400 && data.error === 'Missing required fields') {
      console.log('   ✅ Invoice email endpoint validation is working!\n');
    } else {
      console.log('   ⚠️  Unexpected response from invoice endpoint\n');
    }
  } catch (error) {
    console.log('   ❌ Error connecting to invoice email endpoint:', error.message, '\n');
  }

  console.log('🏁 Email API endpoint testing complete!');
};

testEmailEndpoints();
