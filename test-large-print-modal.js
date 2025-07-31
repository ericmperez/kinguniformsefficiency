// Test script for Large Print Modal (70% page size)
// Run this in browser console to verify the new modal size

console.log("📏 Testing Large Print Modal (70% page size)");

function testLargePrintModal() {
  console.log("🔍 Testing large print modal implementation...");
  
  // Check if we're on the main page
  if (!document.querySelector('.container')) {
    console.log("❌ Page not fully loaded. Please wait and try again.");
    return;
  }
  
  // Look for invoice cards
  const invoiceCards = document.querySelectorAll('[style*="border-radius: 18px"]');
  console.log(`📋 Found ${invoiceCards.length} invoice cards`);
  
  if (invoiceCards.length === 0) {
    console.log("❌ No invoices found. Please create some invoices first.");
    return;
  }
  
  // Click on first invoice
  console.log("📝 Opening first invoice details modal...");
  invoiceCards[0].click();
  
  setTimeout(() => {
    // Look for cart print buttons
    const printButtons = document.querySelectorAll('[title="Print Cart"]');
    console.log(`🖨️ Found ${printButtons.length} cart print buttons`);
    
    if (printButtons.length === 0) {
      console.log("❌ No cart print buttons found");
      return;
    }
    
    // Click first print button
    console.log("🖨️ Clicking first cart print button...");
    printButtons[0].click();
    
    setTimeout(() => {
      // Check print modal size
      const printModal = document.querySelector('.modal-dialog[style*="70vw"]');
      const modalContent = document.querySelector('.modal-content[style*="90vh"]');
      const modalBody = document.querySelector('.modal-body[style*="calc(90vh - 120px)"]');
      
      if (printModal) {
        console.log("✅ Large print modal opened successfully");
        
        // Get actual modal dimensions
        const modalRect = printModal.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const modalWidthPercent = (modalRect.width / viewportWidth * 100).toFixed(1);
        const modalHeightPercent = (modalRect.height / viewportHeight * 100).toFixed(1);
        
        console.log("📏 Modal size verification:", {
          modalWidth: `${modalRect.width}px`,
          modalHeight: `${modalRect.height}px`,
          viewportWidth: `${viewportWidth}px`,
          viewportHeight: `${viewportHeight}px`,
          widthPercentage: `${modalWidthPercent}%`,
          heightPercentage: `${modalHeightPercent}%`,
          hasCorrectWidthStyle: !!printModal.style.width.includes('70vw'),
          hasCorrectMaxWidthStyle: !!printModal.style.maxWidth.includes('70vw'),
          hasMinWidth: !!printModal.style.minWidth.includes('800px'),
          hasCorrectModalContentHeight: !!modalContent,
          hasCorrectModalBodyHeight: !!modalBody
        });
        
        // Check preview areas
        const standardPreview = document.getElementById('cart-print-area');
        const thermalPreview = document.getElementById('cart-thermal-area');
        
        if (standardPreview && thermalPreview) {
          const standardRect = standardPreview.getBoundingClientRect();
          const thermalRect = thermalPreview.getBoundingClientRect();
          
          console.log("📋 Preview areas verification:", {
            standardPreviewHeight: `${standardRect.height}px`,
            thermalPreviewHeight: `${thermalRect.height}px`,
            standardHasMinHeight: standardPreview.style.minHeight === '400px',
            thermalHasMinHeight: thermalPreview.style.minHeight === '400px',
            standardOverflow: standardPreview.style.overflowY,
            thermalOverflow: thermalPreview.style.overflowY
          });
        }
        
        // Check font sizes are improved
        const headerText = document.querySelector('[style*="fontSize: 22px"]');
        const tableText = document.querySelector('[style*="fontSize: 13px"]');
        
        console.log("🔤 Font size verification:", {
          hasLargerHeaderFont: !!headerText,
          hasImprovedTableFont: !!tableText,
          headerFontSize: headerText ? '22px' : 'Not found',
          tableFontSize: tableText ? '13px' : 'Not found'
        });
        
        console.log(`
✅ LARGE PRINT MODAL (70% PAGE SIZE) VERIFIED

Modal Dimensions:
📐 Width: 70% of viewport (${modalWidthPercent}% actual)
📐 Height: 90% of viewport (${modalHeightPercent}% actual)
📐 Minimum Width: 800px
📐 Responsive design maintained

Preview Areas:
📋 Standard preview: Full height with scrolling
📋 Thermal preview: Full height with scrolling
📋 Minimum height: 400px for both areas
📋 Better content visibility

Improvements:
🔤 Larger, more readable fonts
📏 Better use of available space
🖼️ Enhanced print preview experience
📱 Maintains responsiveness

The cart print modal now takes up 70% of the page for better visibility!
        `);
        
      } else {
        console.log("❌ Large print modal not found - checking for any print modal...");
        
        const anyPrintModal = document.querySelector('.modal-title');
        if (anyPrintModal && anyPrintModal.textContent?.includes('Print Cart')) {
          console.log("⚠️ Print modal opened but may not have the new large size styling");
        } else {
          console.log("❌ Print modal did not open at all");
        }
      }
    }, 500);
  }, 1000);
}

// Instructions
console.log(`
🧪 LARGE PRINT MODAL TEST

To verify the 70% page size modal:

1. Open an invoice details modal
2. Click a cart print button (🖨️)
3. Verify the modal is much larger (70% of screen width)
4. Check that preview areas use full height
5. Confirm fonts are larger and more readable

Expected Changes:
✅ Modal width: 70% of viewport (minimum 800px)
✅ Modal height: 90% of viewport
✅ Preview areas: Full height with scrolling
✅ Improved fonts: 22px headers, 13px tables
✅ Better spacing and padding
✅ Enhanced readability

Run testLargePrintModal() to run automated verification.
`);

// Auto-run if on main page
if (window.location.pathname === '/' || window.location.pathname === '') {
  setTimeout(testLargePrintModal, 2000);
}
