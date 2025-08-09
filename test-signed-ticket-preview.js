/**
 * Test Script: Signed Delivery Ticket Preview System
 * 
 * This script helps verify that the PDF preview system is working correctly.
 * 
 * USAGE:
 * 1. Navigate to Settings → 🖨️ Printing in the app
 * 2. Open browser console (F12)
 * 3. Paste this script and press Enter
 * 4. Run: testSignedTicketPreview()
 */

console.log("🔬 Signed Delivery Ticket Preview Test Script Loaded");

/**
 * Test the signed delivery ticket preview functionality
 */
window.testSignedTicketPreview = function() {
  console.log("🚀 Testing Signed Delivery Ticket Preview System...");
  console.log("=" .repeat(70));
  
  // Check if we're on the printing settings page
  const currentPath = window.location.pathname;
  if (!currentPath.includes('printing') && !currentPath.includes('settings')) {
    console.log("❌ Not on printing settings page");
    console.log("💡 Please navigate to Settings → 🖨️ Printing first");
    return;
  }
  
  console.log("✅ On printing settings page");
  
  // Check for PDF Preview buttons
  const pdfPreviewButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent?.includes('PDF Preview'));
  
  console.log(`📋 Found ${pdfPreviewButtons.length} PDF Preview button(s)`);
  
  if (pdfPreviewButtons.length === 0) {
    console.log("❌ No PDF Preview buttons found");
    console.log("💡 Make sure you have clients configured and the page has loaded completely");
    return;
  }
  
  // Test button functionality
  pdfPreviewButtons.forEach((button, index) => {
    const clientRow = button.closest('tr');
    const clientName = clientRow?.querySelector('td:first-child')?.textContent?.trim();
    
    console.log(`\n🔘 PDF Preview Button ${index + 1}:`);
    console.log(`   📝 Client: ${clientName || 'Unknown'}`);
    console.log(`   🎯 Button text: "${button.textContent?.trim()}"`);
    console.log(`   ✅ Button enabled: ${!button.disabled}`);
    console.log(`   🎨 Button classes: ${button.className}`);
  });
  
  // Check for SignedDeliveryTicketPreview component
  const hasPreviewComponent = window.React && 
    document.querySelector('[class*="modal"]') !== null;
  
  console.log(`\n🧩 Component Status:`);
  console.log(`   📦 React available: ${!!window.React}`);
  console.log(`   🔍 Modal containers found: ${document.querySelectorAll('[class*="modal"]').length}`);
  
  // Test clicking the first button (if safe to do so)
  if (pdfPreviewButtons.length > 0) {
    console.log(`\n🧪 Test Instructions:`);
    console.log(`   1. Click any "PDF Preview" button to test the modal`);
    console.log(`   2. Verify the modal opens with preview content`);
    console.log(`   3. Check "Show Preview" / "Hide Preview" toggle`);
    console.log(`   4. Test "New Sample" button for fresh data`);
    console.log(`   5. Verify configuration impact is displayed`);
    console.log(`   6. Close modal and test with different clients`);
  }
  
  console.log("\n" + "=" .repeat(70));
  console.log("✅ PDF Preview System Test Complete");
  
  return {
    buttonsFound: pdfPreviewButtons.length,
    onCorrectPage: currentPath.includes('printing') || currentPath.includes('settings'),
    firstButton: pdfPreviewButtons[0] || null
  };
};

/**
 * Quick functionality test
 */
window.quickPreviewTest = function() {
  console.log("⚡ Quick PDF Preview Test...");
  
  const pdfButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent?.includes('PDF Preview'));
  
  if (pdfButtons.length > 0) {
    console.log(`✅ Found ${pdfButtons.length} PDF Preview buttons`);
    console.log("💡 Click any PDF Preview button to test the modal");
    
    // Highlight the first button for easy identification
    if (pdfButtons[0]) {
      pdfButtons[0].style.outline = '3px solid #ff0000';
      pdfButtons[0].style.outlineOffset = '2px';
      
      setTimeout(() => {
        pdfButtons[0].style.outline = '';
        pdfButtons[0].style.outlineOffset = '';
      }, 3000);
      
      console.log("🔴 First PDF Preview button highlighted for 3 seconds");
    }
  } else {
    console.log("❌ No PDF Preview buttons found");
    console.log("💡 Make sure you're on the printing settings page with clients loaded");
  }
};

/**
 * Check if modal is currently open
 */
window.checkPreviewModal = function() {
  const modals = document.querySelectorAll('.modal.show');
  const previewModal = Array.from(modals).find(modal => 
    modal.textContent?.includes('Signed Delivery Ticket Preview')
  );
  
  if (previewModal) {
    console.log("✅ PDF Preview modal is currently open");
    
    // Check for preview components
    const showPreviewBtn = previewModal.querySelector('button[class*="btn-success"], button:contains("Hide Preview")');
    const newSampleBtn = previewModal.querySelector('button[class*="btn-outline-primary"]');
    const previewContainer = previewModal.querySelector('[style*="transform: scale"]');
    
    console.log("📋 Modal components:");
    console.log(`   🔘 Show/Hide Preview button: ${!!showPreviewBtn}`);
    console.log(`   🔄 New Sample button: ${!!newSampleBtn}`);
    console.log(`   📄 PDF preview container: ${!!previewContainer}`);
    
    if (previewContainer) {
      console.log("✅ PDF preview is rendered and ready");
    }
  } else {
    console.log("❌ No PDF Preview modal currently open");
    console.log("💡 Click a 'PDF Preview' button to open the modal");
  }
};

// Auto-run quick test after script loads
setTimeout(() => {
  console.log("\n🎯 Available test functions:");
  console.log("• testSignedTicketPreview() - Complete functionality test");
  console.log("• quickPreviewTest() - Quick button availability check");
  console.log("• checkPreviewModal() - Check if modal is currently open");
  
  // Auto-run quick test if we're on the right page
  const onPrintingPage = window.location.pathname.includes('printing') || 
                        window.location.pathname.includes('settings');
  
  if (onPrintingPage) {
    console.log("\n🔄 Auto-running quick test...");
    quickPreviewTest();
  }
}, 1000);

console.log("\n📋 Instructions:");
console.log("1. Navigate to Settings → 🖨️ Printing");
console.log("2. Run testSignedTicketPreview() for comprehensive testing");
console.log("3. Click any 'PDF Preview' button to test the modal");
console.log("4. Use checkPreviewModal() while modal is open");
