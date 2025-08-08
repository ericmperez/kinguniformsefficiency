/**
 * Complete PDF Email Test Script
 * Tests PDF generation and email sending functionality
 */

console.log('🧪 PDF Email Test Script Loaded');
console.log('=====================================');

// Test function to check all dependencies
window.checkPDFDependencies = function() {
  console.log('📦 Checking PDF Generation Dependencies...');
  
  const deps = {
    html2canvas: typeof html2canvas !== 'undefined',
    jsPDF: typeof jsPDF !== 'undefined' || typeof window.jsPDF !== 'undefined',
    React: typeof React !== 'undefined'
  };
  
  console.log('Dependencies:', deps);
  
  if (deps.html2canvas && deps.jsPDF) {
    console.log('✅ All PDF dependencies are available');
    return true;
  } else {
    console.log('❌ Some PDF dependencies are missing');
    return false;
  }
};

// Test function to generate a simple PDF
window.testSimplePDF = async function() {
  console.log('🔧 Testing Simple PDF Generation...');
  
  try {
    if (!window.checkPDFDependencies()) {
      throw new Error('PDF dependencies not available');
    }
    
    // Create test content
    const testDiv = document.createElement('div');
    testDiv.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #333;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px;">
          <h1 style="margin: 0; color: #0E62A0; font-size: 24px;">King Uniforms</h1>
          <h2 style="margin: 5px 0 0 0; font-size: 20px;">Test Laundry Ticket</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background-color: #f5f5f5;">
          <div><strong>Ticket #:</strong> TEST-001</div>
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9;">
          <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">Test Client</h3>
          <p style="margin: 5px 0;"><strong>Total Weight:</strong> 8.5 lbs</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #333; border-bottom: 1px solid #333; padding-bottom: 5px;">Items Processed:</h4>
          <div style="padding: 10px; border: 1px solid #ddd;">
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
              <span>Sample Uniform Shirt</span>
              <span>Qty: 5</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
              <span>Sample Uniform Pants</span>
              <span>Qty: 3</span>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p style="margin: 0;">Thank you for choosing King Uniforms</p>
          <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;
    
    // Style the container
    testDiv.style.position = 'fixed';
    testDiv.style.left = '-9999px';
    testDiv.style.top = '0';
    testDiv.style.width = '800px';
    testDiv.style.backgroundColor = 'white';
    testDiv.style.padding = '20px';
    
    document.body.appendChild(testDiv);
    
    console.log('📄 Test content created, generating canvas...');
    
    // Wait for styles to apply
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate canvas
    const canvas = await html2canvas(testDiv, { 
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true
    });
    
    console.log('✅ Canvas generated:', canvas.width, 'x', canvas.height);
    
    // Generate PDF
    const jsPDFConstructor = jsPDF || window.jsPDF;
    const pdf = new jsPDFConstructor({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    const pdfAsString = pdf.output("datauristring");
    
    console.log('✅ PDF generated successfully!');
    console.log('📊 PDF size:', pdfAsString.length, 'characters');
    
    // Clean up
    document.body.removeChild(testDiv);
    
    return pdfAsString;
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    return null;
  }
};

// Test function to send email with PDF
window.testEmailWithPDF = async function() {
  console.log('📧 Testing Email with PDF...');
  
  try {
    // Generate a test PDF
    const pdfContent = await window.testSimplePDF();
    if (!pdfContent) {
      throw new Error('Failed to generate PDF');
    }
    
    console.log('📤 Sending email with PDF attachment...');
    
    // Send email using the API
    const response = await fetch('http://localhost:5173/api/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'emperez@kinguniforms.net',
        subject: 'Test PDF Email - King Uniforms',
        text: 'This is a test email with a PDF attachment generated from the browser.',
        pdfBase64: pdfContent.split(',')[1] || pdfContent
      }),
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Email with PDF sent successfully!');
      console.log('📧 Check your email at emperez@kinguniforms.net');
      return true;
    } else {
      throw new Error(result.error || 'Unknown email error');
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    return false;
  }
};

// Test function to send text email only
window.testTextEmail = async function() {
  console.log('📧 Testing Text Email (no PDF)...');
  
  try {
    const response = await fetch('http://localhost:5173/api/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: 'emperez@kinguniforms.net',
        subject: 'Test Text Email - King Uniforms',
        body: 'This is a test text email without PDF attachment.'
      }),
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Text email sent successfully!');
      return true;
    } else {
      throw new Error(result.error || 'Unknown email error');
    }
    
  } catch (error) {
    console.error('❌ Text email test failed:', error);
    return false;
  }
};

// Main test function
window.runFullEmailTest = async function() {
  console.log('🚀 Running Full Email Test Suite...');
  console.log('=' .repeat(50));
  
  // Step 1: Check dependencies
  console.log('\n1. Checking Dependencies...');
  const depsOk = window.checkPDFDependencies();
  
  // Step 2: Test PDF generation
  console.log('\n2. Testing PDF Generation...');
  const pdfResult = await window.testSimplePDF();
  
  // Step 3: Test text email
  console.log('\n3. Testing Text Email...');
  const textEmailResult = await window.testTextEmail();
  
  // Step 4: Test email with PDF
  console.log('\n4. Testing Email with PDF...');
  const pdfEmailResult = await window.testEmailWithPDF();
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('=' .repeat(30));
  console.log('Dependencies:', depsOk ? '✅ OK' : '❌ Failed');
  console.log('PDF Generation:', pdfResult ? '✅ OK' : '❌ Failed');
  console.log('Text Email:', textEmailResult ? '✅ OK' : '❌ Failed');
  console.log('PDF Email:', pdfEmailResult ? '✅ OK' : '❌ Failed');
  
  if (depsOk && pdfResult && textEmailResult && pdfEmailResult) {
    console.log('\n🎉 ALL TESTS PASSED! PDF email functionality is working!');
  } else {
    console.log('\n⚠️ Some tests failed. Check the details above.');
  }
  
  return {
    dependencies: depsOk,
    pdfGeneration: !!pdfResult,
    textEmail: textEmailResult,
    pdfEmail: pdfEmailResult
  };
};

// Instructions
console.log('\n📋 Available Test Functions:');
console.log('• checkPDFDependencies() - Check if PDF libraries are loaded');
console.log('• testSimplePDF() - Generate a test PDF');
console.log('• testTextEmail() - Send a text-only email');
console.log('• testEmailWithPDF() - Send an email with PDF attachment');
console.log('• runFullEmailTest() - Run all tests');

console.log('\n🚀 Quick Start:');
console.log('Run: runFullEmailTest()');

console.log('\n⚠️ Note: Make sure you are on the app page (not this browser tab) when running tests.');
