// Test script for Cart Print functionality in InvoiceDetailsModal
// Run this in browser console to test the new print feature

console.log("🖨️ Testing Cart Print Functionality");

function testCartPrintFunctionality() {
  console.log("🔍 Testing cart print functionality...");
  
  // Check if the page has loaded
  if (!document.querySelector('.container')) {
    console.log("❌ Page not fully loaded. Please wait and try again.");
    return;
  }
  
  // Look for invoice cards to open details modal
  const invoiceCards = document.querySelectorAll('[style*="border-radius: 18px"]');
  console.log(`📋 Found ${invoiceCards.length} invoice cards`);
  
  if (invoiceCards.length === 0) {
    console.log("❌ No invoices found. Please create some invoices first.");
    return;
  }
  
  // Try to click on the first invoice to open details modal
  const firstInvoice = invoiceCards[0];
  console.log("📝 Clicking on first invoice to open details modal...");
  firstInvoice.click();
  
  // Wait for modal to appear
  setTimeout(() => {
    // Check if invoice details modal opened
    const modal = document.querySelector('.invoice-details-modal');
    if (!modal) {
      console.log("❌ Invoice details modal not found. Try clicking manually on an invoice card.");
      return;
    }
    
    console.log("✅ Invoice details modal opened successfully");
    
    // Look for cart sections and print buttons
    const cartSections = document.querySelectorAll('.cart-section');
    console.log(`🛒 Found ${cartSections.length} cart sections`);
    
    cartSections.forEach((cartSection, index) => {
      const cartTitle = cartSection.querySelector('h3');
      const printButton = cartSection.querySelector('[title="Print Cart"]');
      
      console.log(`Cart ${index + 1}:`, {
        name: cartTitle ? cartTitle.textContent : 'No title',
        hasPrintButton: !!printButton,
        printButtonIcon: printButton ? printButton.querySelector('i')?.className : 'No icon'
      });
      
      if (printButton) {
        console.log(`✅ Print button found for cart: ${cartTitle?.textContent}`);
      } else {
        console.log(`❌ Print button missing for cart: ${cartTitle?.textContent}`);
      }
    });
    
    // Test clicking a print button if available
    const firstPrintButton = document.querySelector('[title="Print Cart"]');
    if (firstPrintButton) {
      console.log("🖨️ Testing print button click...");
      firstPrintButton.click();
      
      // Check if print modal appears
      setTimeout(() => {
        const printModal = document.querySelector('.modal-title:contains("Print Cart")');
        if (printModal || document.querySelector('.modal-title')?.textContent?.includes('Print Cart')) {
          console.log("✅ Cart print modal opened successfully!");
          
          // Look for print preview areas
          const printArea = document.getElementById('cart-print-area');
          const thermalArea = document.getElementById('cart-thermal-area');
          
          console.log("Print areas found:", {
            standardPrintArea: !!printArea,
            thermalPrintArea: !!thermalArea
          });
          
          // Look for print buttons in modal
          const printButtons = document.querySelectorAll('.modal-footer .btn');
          console.log(`🔘 Found ${printButtons.length} buttons in print modal`);
          
          printButtons.forEach((btn, i) => {
            console.log(`Button ${i + 1}: ${btn.textContent?.trim()}`);
          });
          
        } else {
          console.log("❌ Cart print modal did not open");
        }
      }, 500);
    }
    
  }, 1000);
}

// Instructions for manual testing
console.log(`
🧪 CART PRINT FUNCTIONALITY TEST

To test the new cart print functionality:

1. Make sure you have at least one invoice with carts
2. Click on an invoice card to open the details modal
3. Look for the 🖨️ print button next to each cart name
4. Click the print button to open the cart print modal
5. Verify you see:
   - Standard A4 print preview on the left
   - Thermal receipt preview on the right
   - Print buttons at the bottom

Expected Features:
✅ Print button appears next to cart edit/delete buttons
✅ Print modal opens with cart contents
✅ Two print formats: A4 standard and 3" thermal receipt
✅ Print configuration respects client settings
✅ Cart contents display correctly in both formats

Run testCartPrintFunctionality() to run automated tests.
`);

// Auto-run test if we detect we're on the main page
if (window.location.pathname === '/' || window.location.pathname === '') {
  setTimeout(testCartPrintFunctionality, 2000);
}
