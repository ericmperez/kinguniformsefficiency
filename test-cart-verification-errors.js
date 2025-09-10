// Test script for cart ID verification error handling
// This script can be used to test the alarm and email functionality

const testCartIdVerificationError = async () => {
  console.log('🧪 Testing Cart ID Verification Error System...');
  
  try {
    // Test email notification
    const response = await fetch('http://localhost:3001/api/send-verification-error-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientName: 'Test Client',
        errorMessage: 'Cart ID "INVALID123" not found in group Test Client',
        username: 'TestUser',
        verificationType: 'Cart ID Verification',
        date: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      console.log('✅ Email notification test successful');
    } else {
      console.error('❌ Email notification test failed');
    }
  } catch (error) {
    console.error('❌ Error testing email notification:', error);
  }
};

// Test the error handling system
const testErrorHandling = () => {
  console.log('🧪 Testing Error Handling System...');
  
  // Simulate invalid cart ID scenarios
  const testScenarios = [
    {
      scenario: 'Invalid Cart ID',
      cartId: 'INVALID123',
      expectedError: 'Cart ID not found'
    },
    {
      scenario: 'Empty Cart ID',
      cartId: '',
      expectedError: 'Empty cart ID'
    },
    {
      scenario: 'Duplicate Cart ID',
      cartId: 'DUPLICATE456',
      expectedError: 'Already verified'
    }
  ];

  testScenarios.forEach(test => {
    console.log(`📋 Testing: ${test.scenario}`);
    console.log(`   Input: "${test.cartId}"`);
    console.log(`   Expected: ${test.expectedError}`);
  });
};

// Run tests when this file is loaded
if (typeof window !== 'undefined') {
  // Browser environment
  window.testCartIdVerificationError = testCartIdVerificationError;
  window.testErrorHandling = testErrorHandling;
  
  console.log('🧪 Cart ID Verification Error Tests loaded');
  console.log('Run testCartIdVerificationError() to test email notifications');
  console.log('Run testErrorHandling() to test error scenarios');
} else {
  // Node.js environment
  module.exports = {
    testCartIdVerificationError,
    testErrorHandling
  };
}
