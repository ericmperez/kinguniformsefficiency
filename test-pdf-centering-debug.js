// PDF Centering Debug Test
// Run this in browser console to test PDF generation and check centering

console.log('🔍 PDF Centering Debug Test');
console.log('='.repeat(50));

// Function to test PDF generation with specific settings
function testPDFCentering() {
  console.log('\n📋 Testing PDF Generation Settings...');
  
  // Check if we're on the right page
  const currentURL = window.location.href;
  console.log(`Current URL: ${currentURL}`);
  
  if (!currentURL.includes('printing') && !currentURL.includes('settings')) {
    console.log('❌ Not on printing settings page');
    console.log('💡 Navigate to Settings → 🖨️ Printing first');
    return;
  }
  
  // Look for PDF Preview modal
  const modal = document.querySelector('.modal.show');
  if (!modal) {
    console.log('❌ No modal is currently open');
    console.log('💡 Click "PDF Preview" for any client first');
    return;
  }
  
  // Check if it's the right modal
  if (!modal.textContent?.includes('Signed Delivery Ticket Preview')) {
    console.log('❌ Wrong modal is open');
    console.log('💡 Close current modal and click "PDF Preview" button');
    return;
  }
  
  console.log('✅ PDF Preview modal is open');
  
  // Check pagination setting
  const paginationSelect = modal.querySelector('select[value*="single"], select[value*="multiple"]');
  if (paginationSelect) {
    const paginationValue = paginationSelect.value;
    console.log(`📄 Current pagination setting: ${paginationValue}`);
    
    if (paginationValue !== 'single') {
      console.log('⚠️  Pagination is not set to "single" - this may affect centering');
      console.log('💡 Change pagination to "Single Page (compressed)" for proper centering');
    } else {
      console.log('✅ Pagination is set to "single" - should use centering logic');
    }
  } else {
    console.log('⚠️  Could not find pagination setting');
  }
  
  // Check margins setting
  const marginsSelect = modal.querySelector('select[value*="narrow"], select[value*="normal"], select[value*="wide"]');
  if (marginsSelect) {
    const marginsValue = marginsSelect.value;
    console.log(`📏 Current margins setting: ${marginsValue}`);
  }
  
  // Find download button
  const downloadBtn = Array.from(modal.querySelectorAll('button')).find(btn => 
    btn.textContent?.includes('Download PDF')
  );
  
  if (downloadBtn) {
    console.log('✅ Download PDF button found');
    console.log('\n🧪 Test Instructions:');
    console.log('1. Ensure pagination is set to "Single Page (compressed)"');
    console.log('2. Set margins to "Normal"');  
    console.log('3. Click "Download PDF" button');
    console.log('4. Check browser console for centering calculation logs');
    console.log('5. Open the downloaded PDF to verify centering');
    
    console.log('\n📊 Expected Console Logs:');
    console.log('• "📄 PDF Generation Mode Check"');
    console.log('• "🎯 Using SINGLE PAGE MODE for centering"');
    console.log('• "📍 PDF Centering Calculations"');
    console.log('• Position values showing x > 0 and y > 0 (indicating margins)');
    
    // Add click event listener to capture logs
    console.log('\n🎯 Click the Download PDF button now to test...');
    
  } else {
    console.log('❌ Download PDF button not found');
  }
  
  return {
    modalOpen: !!modal,
    correctModal: modal?.textContent?.includes('Signed Delivery Ticket Preview'),
    downloadButtonFound: !!downloadBtn
  };
}

// Function to highlight the download button for easy identification  
function highlightDownloadButton() {
  const modal = document.querySelector('.modal.show');
  if (modal) {
    const downloadBtn = Array.from(modal.querySelectorAll('button')).find(btn => 
      btn.textContent?.includes('Download PDF')
    );
    
    if (downloadBtn) {
      downloadBtn.style.outline = '3px solid #ff0000';
      downloadBtn.style.outlineOffset = '2px';
      downloadBtn.style.animation = 'pulse 1s infinite';
      
      console.log('🔴 Download PDF button highlighted in red');
      
      setTimeout(() => {
        downloadBtn.style.outline = '';
        downloadBtn.style.outlineOffset = '';
        downloadBtn.style.animation = '';
      }, 5000);
    }
  }
}

// Run the test
testPDFCentering();

// Make functions available globally
window.testPDFCentering = testPDFCentering;
window.highlightDownloadButton = highlightDownloadButton;

console.log('\n🔧 Available Functions:');
console.log('• testPDFCentering() - Run the centering test');
console.log('• highlightDownloadButton() - Highlight the download button');
