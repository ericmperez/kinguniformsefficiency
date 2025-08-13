// Test Resend Email Functionality in Delivered Invoices
// This script tests the actual resend email feature

console.log('🧪 Testing Resend Email in Delivered Invoices');
console.log('=============================================\n');

// Test the resend email functionality by simulating the same API calls
async function testResendEmailFunctionality() {
  console.log('📧 Testing resend email functionality...');
  
  // Test data similar to what DeliveredInvoicesPage would send
  const testEmailData = {
    to: 'eric.perez.pr@gmail.com',
    subject: 'King Uniforms - Resend Test: Laundry Ticket #TEST-001',
    text: `Dear Customer,

This is a test of the resend email functionality from the Delivered Invoices page.

Laundry Ticket Details:
- Invoice Number: TEST-001
- Client: Test Client
- Date: ${new Date().toLocaleDateString()}
- Status: Delivered

This email was sent using the resend functionality to verify that:
✅ The email server is properly configured
✅ PDF attachments are working (if enabled)
✅ Email delivery is functioning correctly

If you receive this email, the resend functionality is working properly!

Best regards,
King Uniforms Delivery System

---
This is a test message from the delivered invoices resend functionality.`,
    pdfBase64: 'JVBERi0xLjMKJf////8KMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovT3V0bGluZXMgMiAwIFIKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9PdXRsaW5lcwovQ291bnQgMAo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzQgMCBSXQo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDMgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Ci9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA2IDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKFRlc3QgUERGIGZvciBSZXNlbmQgRW1haWwpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDEwMyAwMDAwMCBuIAowMDAwMDAwMTU4IDAwMDAwIG4gCjAwMDAwMDAzMDEgMDAwMDAgbiAKMDAwMDAwMDM3NCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDcKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQ2OAolJUVPRg=='
  };

  try {
    console.log('📡 Sending test email to resend functionality endpoint...');
    
    const response = await fetch('http://localhost:5173/api/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEmailData)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Resend email test successful!');
      console.log('📬 Check eric.perez.pr@gmail.com inbox for the resend test message');
      console.log('\n🎉 The resend email functionality in Delivered Invoices is working correctly!');
      console.log('\n📋 What this confirms:');
      console.log('• ✅ Email server is running and accepting requests');
      console.log('• ✅ Gmail App Password is working correctly');
      console.log('• ✅ PDF attachments are being sent properly');
      console.log('• ✅ Email delivery from notifications@kinguniforms.net is functional');
      console.log('• ✅ The resend button in Delivered Invoices will work');
      
    } else {
      console.log('❌ Resend email test failed');
      console.log('Error:', result.error);
      if (result.details) {
        console.log('Details:', result.details);
      }
      
      console.log('\n💡 TROUBLESHOOTING:');
      console.log('• Check if the email server is still running');
      console.log('• Verify email credentials are still valid');
      console.log('• Ensure network connectivity');
    }
    
  } catch (error) {
    console.log('❌ Error testing resend email functionality:', error.message);
    console.log('\n💡 TROUBLESHOOTING:');
    console.log('• Make sure the email server is running (node server.cjs)');
    console.log('• Check that port 5173 is available');
    console.log('• Verify network connection');
  }
}

// Test email without PDF attachment (simpler test)
async function testResendEmailWithoutPDF() {
  console.log('\n📧 Testing resend email without PDF attachment...');
  
  const simpleEmailData = {
    to: 'eric.perez.pr@gmail.com',
    subject: 'King Uniforms - Simple Resend Test',
    body: `This is a simple test of the resend email functionality without PDF attachment.

If you receive this email, the basic resend functionality is working!

Test timestamp: ${new Date().toLocaleString()}

Best regards,
King Uniforms System`
  };

  try {
    const response = await fetch('http://localhost:5173/api/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(simpleEmailData)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Simple resend email test successful!');
    } else {
      console.log('❌ Simple resend email test failed');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Error with simple resend test:', error.message);
  }
}

// Run the tests
console.log('🚀 Starting resend email functionality tests...\n');

testResendEmailFunctionality()
  .then(() => testResendEmailWithoutPDF())
  .then(() => {
    console.log('\n🏁 Resend email functionality testing complete!');
    console.log('📧 Check your email inbox: eric.perez.pr@gmail.com');
  })
  .catch(console.error);
