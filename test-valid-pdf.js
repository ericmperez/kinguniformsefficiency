/**
 * Test Valid PDF Generation and Email
 * This creates a known valid PDF and tests email delivery
 */

console.log('🧪 Testing Valid PDF Email System');
console.log('=================================\n');

// Create a minimal valid PDF in base64 format
const createMinimalValidPDF = () => {
  // This is a minimal valid PDF file encoded in base64
  // It contains just "Hello World" text
  const validPDFBase64 = `JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL091dGxpbmVzIDIgMCBSCi9QYWdlcyAzIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKL1R5cGUgL091dGxpbmVzCi9Db3VudCAwCj4+CmVuZG9iagoKMyAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDEKL0tpZHMgWzQgMCBSXQo+PgplbmRvYmoKCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAzIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSAHIDAgUgo+PgovUHJvY1NldCA2IDAgUgo+PgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCgo1IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoyIDcwMCBUZAooS2luZyBVbmlmb3JtcyBUZXN0IExhdW5kcnkgVGlja2V0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCgo2IDAgb2JqClsvUERGIC9UZXh0XQplbmRvYmoKCjcgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9OYW1lIC9GMQovQmFzZUZvbnQgL0hlbHZldGljYQovRW5jb2RpbmcgL01hY1JvbWFuRW5jb2RpbmcKPj4KZW5kb2JqCgp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3NCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIG4gCjAwMDAwMDAxNzcgMDAwMDAgbiAKMDAwMDAwMDM2NCAwMDAwMCBuIAowMDAwMDAwNDU4IDAwMDAwIG4gCjAwMDAwMDA0ODkgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA4Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo2MDAKJSVFT0Y=`;
  
  return validPDFBase64;
};

// Test function
const testValidPDFEmail = async () => {
  try {
    const validPDF = createMinimalValidPDF();
    
    console.log('📄 Created valid PDF (base64 length:', validPDF.length, ')');
    
    // Test the PDF by sending it via email
    console.log('📧 Sending test email with valid PDF...');
    
    const response = await fetch('http://localhost:5173/api/send-test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'emperez@kinguniforms.net',
        subject: '✅ TEST: Valid PDF Attachment for Signature Email',
        body: `This email contains a minimal valid PDF to test the signature email system.

PDF Details:
• Type: Minimal valid PDF with text content
• Size: ${validPDF.length} characters (base64)
• Content: "King Uniforms Test Laundry Ticket"

If you can open this PDF attachment successfully, the email system is working correctly and the issue is with PDF generation, not email delivery.

Generated: ${new Date().toLocaleString()}`,
        pdfBase64: validPDF
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Email with valid PDF sent successfully!');
      console.log('📧 Check your email inbox and try opening the PDF attachment');
      console.log('📋 If this PDF opens correctly, the issue is with PDF generation');
      console.log('📋 If this PDF doesn\'t open, the issue is with email delivery');
    } else {
      console.log('❌ Email sending failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
testValidPDFEmail();

console.log('\n💡 This test will help determine if the issue is:');
console.log('   1. PDF generation (if valid PDF works but generated ones don\'t)');
console.log('   2. Email delivery (if even valid PDFs don\'t work)');
