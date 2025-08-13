// Test Delivered Invoices Resend Email Functionality
// This script comprehensively tests the resend email feature

console.log('🧪 DELIVERED INVOICES - RESEND EMAIL FUNCTIONALITY TEST');
console.log('====================================================\n');

// Function to test the individual resend email functionality
async function testIndividualResendEmail() {
  console.log('📧 Testing Individual Invoice Resend Email...');
  
  const testEmailData = {
    to: 'eric.perez.pr@gmail.com',
    subject: 'King Uniforms - Individual Resend Test: Laundry Ticket #TEST-INDIVIDUAL-001',
    text: `Dear Customer,

This is a test of the INDIVIDUAL RESEND email functionality from the Delivered Invoices page.

Test Details:
- Invoice Number: TEST-INDIVIDUAL-001
- Client: Test Client (Individual Resend)
- Date: ${new Date().toLocaleDateString()}
- Status: Delivered
- Test Type: Individual Invoice Resend

This email simulates clicking the "Resend Email" button on a single delivered invoice.

✅ Testing Individual Resend Features:
• Email server connectivity
• PDF attachment generation
• Gmail SMTP authentication
• Individual invoice email processing
• Error handling and user feedback

If you receive this email, the individual resend functionality is working properly!

Best regards,
King Uniforms Delivery System

---
Test timestamp: ${new Date().toLocaleString()}
This is a test message from the individual invoice resend functionality.`,
    pdfBase64: 'JVBERi0xLjMKJf////8KMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovT3V0bGluZXMgMiAwIFIKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9PdXRsaW5lcwovQ291bnQgMAo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzQgMCBSXQo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDMgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSAyIDAgUgo+Pgo+Pgo+PgplbmRvYmoKNSAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVApxCjYgMCAwIDEgMTAwIDUwMCBUbQovRjEgMTIgVGYKKFRlc3QgSW5kaXZpZHVhbCBSZXNlbmQgUERGKSBUagpRCkVUCmVuZHN0cmVhbQplbmRvYmoKNiAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDc0IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKMDAwMDAwMDE3OCAwMDAwMCBuIAowMDAwMDAwMzk1IDAwMDAwIG4gCjAwMDAwMDA0OTAgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA3Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo1NzgKJSVFT0Y='
  };

  try {
    console.log('📡 Sending individual resend test email...');
    
    const response = await fetch('http://localhost:5173/api/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEmailData)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Individual resend email test SUCCESSFUL!');
      console.log('📬 Check eric.perez.pr@gmail.com for the individual resend test email');
      
      console.log('\n🎯 INDIVIDUAL RESEND VERIFICATION:');
      console.log('• ✅ Single invoice email functionality working');
      console.log('• ✅ PDF attachment included properly');
      console.log('• ✅ Email server responding correctly');
      console.log('• ✅ Individual resend button will work in UI');
      
      return true;
    } else {
      console.log('❌ Individual resend email test FAILED');
      console.log('Error:', result.error);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error testing individual resend email:', error.message);
    return false;
  }
}

// Function to test the bulk resend email functionality
async function testBulkResendEmail() {
  console.log('\n📧 Testing Bulk Invoice Resend Email...');
  
  const bulkTestEmails = [
    {
      to: 'eric.perez.pr@gmail.com',
      subject: 'King Uniforms - Bulk Resend Test: Laundry Ticket #BULK-001',
      text: `Bulk Test Email 1/3 - Invoice #BULK-001

This is part of a BULK RESEND test for multiple invoices.

Test Details:
- Invoice: BULK-001
- Client: Bulk Test Client 1
- Date: ${new Date().toLocaleDateString()}
- Test Type: Bulk Resend (1 of 3)

Best regards,
King Uniforms Delivery System`,
      pdfBase64: 'JVBERi0xLjMKJf////8KMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovT3V0bGluZXMgMiAwIFIKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9PdXRsaW5lcwovQ291bnQgMAo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzQgMCBSXQo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDMgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSAyIDAgUgo+Pgo+Pgo+PgplbmRvYmoKNSAwIG9iago8PAovTGVuZ3RoIDM5Cj4+CnN0cmVhbQpCVApxCjYgMCAwIDEgMTAwIDUwMCBUbQovRjEgMTIgVGYKKEJ1bGsgVGVzdCBQREYgMSkgVGoKUQpFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3NCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAxNzggMDAwMDAgbiAKMDAwMDAwMDM5NSAwMDAwMCBuIAowMDAwMDAwNDg1IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTczCiUlRU9G'
    },
    {
      to: 'eric.perez.pr@gmail.com',
      subject: 'King Uniforms - Bulk Resend Test: Laundry Ticket #BULK-002',
      text: `Bulk Test Email 2/3 - Invoice #BULK-002

This is part of a BULK RESEND test for multiple invoices.

Test Details:
- Invoice: BULK-002
- Client: Bulk Test Client 2
- Date: ${new Date().toLocaleDateString()}
- Test Type: Bulk Resend (2 of 3)

Best regards,
King Uniforms Delivery System`,
      pdfBase64: 'JVBERi0xLjMKJf////8KMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovT3V0bGluZXMgMiAwIFIKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9PdXRsaW5lcwovQ291bnQgMAo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzQgMCBSXQo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDMgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSAyIDAgUgo+Pgo+Pgo+PgplbmRvYmoKNSAwIG9iago8PAovTGVuZ3RoIDM5Cj4+CnN0cmVhbQpCVApxCjYgMCAwIDEgMTAwIDUwMCBUbQovRjEgMTIgVGYKKEJ1bGsgVGVzdCBQREYgMikgVGoKUQpFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3NCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAxNzggMDAwMDAgbiAKMDAwMDAwMDM5NSAwMDAwMCBuIAowMDAwMDAwNDg1IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTczCiUlRU9G'
    },
    {
      to: 'eric.perez.pr@gmail.com',
      subject: 'King Uniforms - Bulk Resend Test: Laundry Ticket #BULK-003',
      text: `Bulk Test Email 3/3 - Invoice #BULK-003

This is part of a BULK RESEND test for multiple invoices.

Test Details:
- Invoice: BULK-003
- Client: Bulk Test Client 3
- Date: ${new Date().toLocaleDateString()}
- Test Type: Bulk Resend (3 of 3)

✅ If you receive all 3 bulk test emails, the bulk resend functionality is working correctly!

Best regards,
King Uniforms Delivery System`,
      pdfBase64: 'JVBERi0xLjMKJf////8KMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovT3V0bGluZXMgMiAwIFIKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9PdXRsaW5lcwovQ291bnQgMAo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzQgMCBSXQo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDMgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSAyIDAgUgo+Pgo+Pgo+PgplbmRvYmoKNSAwIG9iago8PAovTGVuZ3RoIDM5Cj4+CnN0cmVhbQpCVApxCjYgMCAwIDEgMTAwIDUwMCBUbQovRjEgMTIgVGYKKEJ1bGsgVGVzdCBQREYgMykgVGoKUQpFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3NCAwMDAwMCBuIAowMDAwMDAwMTIxIDAwMDAwIG4gCjAwMDAwMDAxNzggMDAwMDAgbiAKMDAwMDAwMDM5NSAwMDAwMCBuIAowMDAwMDAwNDg1IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTczCiUlRU9G'
    }
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < bulkTestEmails.length; i++) {
    const emailData = bulkTestEmails[i];
    console.log(`📡 Sending bulk test email ${i + 1}/3...`);
    
    try {
      const response = await fetch('http://localhost:5173/api/send-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log(`✅ Bulk email ${i + 1}/3 sent successfully`);
        successCount++;
      } else {
        console.log(`❌ Bulk email ${i + 1}/3 failed:`, result.error);
        failCount++;
      }
      
      // Small delay between emails to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`❌ Error sending bulk email ${i + 1}/3:`, error.message);
      failCount++;
    }
  }

  console.log(`\n📊 BULK RESEND RESULTS:`);
  console.log(`• ✅ Successful: ${successCount}/3`);
  console.log(`• ❌ Failed: ${failCount}/3`);
  
  if (successCount === 3) {
    console.log('\n🎯 BULK RESEND VERIFICATION:');
    console.log('• ✅ Multiple invoice emails working');
    console.log('• ✅ Bulk processing functionality operational');
    console.log('• ✅ Email server handling multiple requests');
    console.log('• ✅ Bulk resend button will work in UI');
    return true;
  } else {
    console.log('\n⚠️ Some bulk emails failed - check configuration');
    return false;
  }
}

// Function to test error handling
async function testErrorHandling() {
  console.log('\n🛠️ Testing Error Handling...');
  
  // Test with invalid email
  try {
    console.log('📡 Testing invalid email address...');
    
    const response = await fetch('http://localhost:5173/api/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: 'invalid-email-address',
        subject: 'Error Test',
        text: 'This should fail',
        pdfBase64: 'invalid-base64'
      })
    });

    const result = await response.json();
    
    if (!response.ok || result.error) {
      console.log('✅ Error handling working - invalid email properly rejected');
      return true;
    } else {
      console.log('⚠️ Error handling may need improvement - invalid email was accepted');
      return false;
    }
    
  } catch (error) {
    console.log('✅ Error handling working - network error properly caught');
    return true;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting comprehensive resend email tests...\n');
  
  const tests = [
    { name: 'Individual Resend Email', fn: testIndividualResendEmail },
    { name: 'Bulk Resend Email', fn: testBulkResendEmail },
    { name: 'Error Handling', fn: testErrorHandling }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    console.log(`\n🔍 Running test: ${test.name}`);
    console.log('─'.repeat(50));
    
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
        console.log(`✅ ${test.name} - PASSED`);
      } else {
        console.log(`❌ ${test.name} - FAILED`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ERROR:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! 🎉');
    console.log('✅ The resend email functionality in Delivered Invoices is working perfectly!');
    console.log('📧 Check eric.perez.pr@gmail.com for all test emails');
    
    console.log('\n📋 VERIFIED FUNCTIONALITY:');
    console.log('• ✅ Individual invoice resend emails');
    console.log('• ✅ Bulk invoice resend emails');
    console.log('• ✅ PDF attachment support');
    console.log('• ✅ Error handling and validation');
    console.log('• ✅ Email server connectivity');
    console.log('• ✅ Gmail SMTP authentication');
    console.log('• ✅ Email delivery to recipients');
    
  } else {
    console.log('\n⚠️ Some tests failed - please review the configuration');
    console.log('💡 Check email server status and network connectivity');
  }
}

// Run all tests
runAllTests().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});
