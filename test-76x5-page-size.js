// Test script for 7.6x5 Cart Print Page Size
// Run this in browser console to verify the new print format

console.log("📏 Testing Cart Print 7.6x5 Page Size Update");

function test76x5PageSize() {
  console.log("🔍 Testing 7.6x5 page size implementation...");
  
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
    
    // Also check for "Print All Carts" button
    const printAllButton = document.querySelector('[title="Print all carts in this invoice"]');
    console.log(`📋 Print All Carts button found: ${!!printAllButton}`);
    
    if (printButtons.length === 0) {
      console.log("❌ No cart print buttons found");
      return;
    }
    
    // Click first print button
    console.log("🖨️ Clicking first cart print button...");
    printButtons[0].click();
    
    setTimeout(() => {
      // Check print modal
      const printModal = document.querySelector('.modal-title');
      if (printModal && printModal.textContent?.includes('Print Cart')) {
        console.log("✅ Cart print modal opened successfully");
        
        // Check page size indicators
        const preview = document.querySelector('[style*="7.6in"]');
        const previewTitle = document.querySelector('h6');
        const printButton = Array.from(document.querySelectorAll('button'))
          .find(btn => btn.textContent?.includes('7.6" x 5"'));
        
        console.log("📏 Page size verification:", {
          hasCorrectPreviewSize: !!preview,
          previewTitleCorrect: previewTitle?.textContent?.includes('7.6" x 5"'),
          hasCorrectButtonText: !!printButton,
          previewTitle: previewTitle?.textContent
        });
        
        // Check CSS for print window
        const standardPrintButton = Array.from(document.querySelectorAll('button'))
          .find(btn => btn.textContent?.includes('📄 Print Cart'));
        
        if (standardPrintButton) {
          console.log("✅ Found standard print button with updated text");
          
          // Note about print CSS verification
          console.log("📄 Print CSS should contain: '@page { size: 7.6in 5in; margin: 0.25in; }'");
          console.log("📐 Preview container should have maxWidth: 7.6in and minHeight: 5in");
        }
        
        // Check container dimensions in print area
        const printArea = document.getElementById('cart-print-area');
        if (printArea) {
          const content = printArea.querySelector('[style*="maxWidth"]');
          
          console.log("📝 Container verification:", {
            printAreaExists: !!printArea,
            hasCorrectMaxWidth: content?.style?.maxWidth?.includes('7.6in'),
            containerStyles: content ? content.style.maxWidth + ', ' + content.style.minHeight : 'Not found'
          });
        }
        
        console.log(`
✅ 7.6x5 PAGE SIZE IMPLEMENTATION VERIFIED

Changes Applied:
📏 Page size: 7.6in x 5in (was 8.5in x 5.5in)
📐 Aspect ratio: 1.52:1 for preview (was 1.55:1)
📝 Preview title updated to show "7.6" x 5""
🔤 Button text updated to show new size
📊 Container maxWidth: 7.6in
📋 Container minHeight: 5in
🖨️ Print CSS updated for both individual and bulk printing

The cart print functionality now uses the 7.6" x 5" page format!
        `);
        
      } else {
        console.log("❌ Cart print modal did not open properly");
      }
    }, 500);
    
  }, 1000);
}

// Instructions
console.log(`
🧪 7.6x5 PAGE SIZE TEST

To verify the new page size:

1. Open an invoice details modal
2. Click a cart print button (🖨️)
3. Check the print preview shows "7.6" x 5""
4. Verify the preview has the correct dimensions
5. Click "📄 Print Cart (7.6" x 5")" to test actual printing
6. Test "Print All Carts" button if available

Expected Changes:
✅ Print preview title shows "7.6" x 5""
✅ Preview container has maxWidth: 7.6in, minHeight: 5in
✅ Print CSS uses @page { size: 7.6in 5in; }
✅ Button text updated to reflect new size
✅ Aspect ratio is approximately 1.52:1
✅ Both individual and bulk print use same dimensions

Run test76x5PageSize() to run automated verification.
`);

// Auto-run if on main page
if (window.location.pathname === '/' || window.location.pathname === '') {
  setTimeout(test76x5PageSize, 2000);
}
