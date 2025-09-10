/**
 * Print Button Position Test Script
 * 
 * This script investigates the positioning of print buttons in the InvoiceDetailsModal
 * to understand why they might appear above the cart list instead of below.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5187
 * 2. Navigate to an invoice with multiple carts
 * 3. Open the invoice details modal
 * 4. Open browser console (F12)
 * 5. Paste this script and press Enter
 * 6. Run: testPrintButtonPosition()
 */

console.log("🔍 Print Button Position Test Script Loaded");

/**
 * Test the positioning of print buttons
 */
window.testPrintButtonPosition = function() {
  console.log("🚀 Testing Print Button Position...");
  console.log("=" .repeat(60));
  
  // Check if we're in the correct context
  const modal = document.querySelector('.invoice-details-modal');
  if (!modal) {
    console.log("❌ Invoice details modal not found.");
    console.log("Please open an invoice details modal first.");
    return;
  }
  
  console.log("✅ Invoice details modal detected");
  
  // Look for cart sections
  const cartSections = document.querySelectorAll('.cart-section, .enhanced-cart-section');
  console.log(`📋 Found ${cartSections.length} cart section(s) in the invoice`);
  
  // Look for all Print All Carts buttons
  const printAllButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent?.includes('Print All Carts'));
  
  console.log(`🖨️ Found ${printAllButtons.length} "Print All Carts" button(s)`);
  
  if (printAllButtons.length === 0) {
    console.log("❌ No 'Print All Carts' buttons found.");
    
    // Look for Create New Cart button to see if we're in the right place
    const createCartButton = Array.from(document.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Create New Cart'));
    
    if (createCartButton) {
      console.log("✅ Found 'Create New Cart' button - we're in the correct area");
      console.log("⚠️  Print buttons might not be visible due to conditional rendering");
    }
    return;
  }
  
  // Analyze each Print All Carts button
  printAllButtons.forEach((button, index) => {
    console.log(`\n🔍 Analyzing Print All Carts button ${index + 1}:`);
    console.log(`   Text: "${button.textContent?.trim()}"`);
    console.log(`   Classes: ${button.className}`);
    
    // Get position information
    const rect = button.getBoundingClientRect();
    const parent = button.parentElement;
    
    console.log(`   Position: ${rect.left.toFixed(0)}px, ${rect.top.toFixed(0)}px`);
    console.log(`   Size: ${rect.width.toFixed(0)}px × ${rect.height.toFixed(0)}px`);
    console.log(`   Parent element: ${parent?.tagName} (${parent?.className})`);
    
    // Check if button is visible
    const isVisible = rect.width > 0 && rect.height > 0 && 
                     window.getComputedStyle(button).visibility !== 'hidden' &&
                     window.getComputedStyle(button).display !== 'none';
    console.log(`   Visible: ${isVisible}`);
    
    // Find the closest cart sections relative to this button
    let cartPositions = [];
    cartSections.forEach((cart, cartIndex) => {
      const cartRect = cart.getBoundingClientRect();
      cartPositions.push({
        index: cartIndex,
        top: cartRect.top,
        bottom: cartRect.bottom,
        name: cart.querySelector('h3')?.textContent?.trim() || `Cart ${cartIndex + 1}`
      });
    });
    
    // Sort cart positions by their top position
    cartPositions.sort((a, b) => a.top - b.top);
    
    console.log(`\n📍 Cart positions relative to button:`);
    cartPositions.forEach(cart => {
      const relativePosition = cart.top < rect.top ? 'ABOVE' : 'BELOW';
      console.log(`   ${cart.name}: ${relativePosition} button (cart top: ${cart.top.toFixed(0)}px)`);
    });
    
    // Determine if button is positioned correctly (should be below all carts)
    const allCartsAboveButton = cartPositions.every(cart => cart.bottom < rect.top);
    const someCartsAboveButton = cartPositions.some(cart => cart.bottom < rect.top);
    
    console.log(`\n📊 Position Analysis:`);
    console.log(`   Button at: ${rect.top.toFixed(0)}px`);
    console.log(`   All carts above button: ${allCartsAboveButton}`);
    console.log(`   Some carts above button: ${someCartsAboveButton}`);
    
    if (allCartsAboveButton) {
      console.log("✅ Button is correctly positioned BELOW all carts");
    } else if (someCartsAboveButton) {
      console.log("⚠️  Button is BETWEEN carts (unexpected)");
    } else {
      console.log("❌ Button appears ABOVE all carts (problem identified!)");
    }
  });
  
  // Look for other print-related buttons that might be confusing the issue
  const otherPrintButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => {
      const text = btn.textContent?.toLowerCase() || '';
      return text.includes('print') && !text.includes('print all carts');
    });
  
  if (otherPrintButtons.length > 0) {
    console.log(`\n🔍 Found ${otherPrintButtons.length} other print button(s):`);
    otherPrintButtons.forEach((btn, index) => {
      const rect = btn.getBoundingClientRect();
      console.log(`   ${index + 1}. "${btn.textContent?.trim()}" at ${rect.top.toFixed(0)}px`);
    });
  }
  
  // Check for any CSS issues that might affect positioning
  console.log(`\n🎨 CSS Analysis:`);
  const modalBody = modal.querySelector('.modal-body');
  if (modalBody) {
    const modalStyle = window.getComputedStyle(modalBody);
    console.log(`   Modal body display: ${modalStyle.display}`);
    console.log(`   Modal body overflow: ${modalStyle.overflow}`);
    console.log(`   Modal body height: ${modalStyle.height}`);
  }
  
  console.log(`\n📋 Summary:`);
  console.log(`   • Cart sections: ${cartSections.length}`);
  console.log(`   • Print All buttons: ${printAllButtons.length}`);
  console.log(`   • Other print buttons: ${otherPrintButtons.length}`);
  
  if (printAllButtons.length > 1) {
    console.log("⚠️  Multiple 'Print All Carts' buttons found - this might be causing confusion");
  }
};

/**
 * Quick check for duplicate print buttons
 */
window.checkForDuplicatePrintButtons = function() {
  console.log("🔍 Checking for duplicate print buttons...");
  
  const printAllButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent?.includes('Print All Carts'));
  
  console.log(`Found ${printAllButtons.length} "Print All Carts" button(s)`);
  
  if (printAllButtons.length > 1) {
    console.log("⚠️  MULTIPLE PRINT BUTTONS DETECTED!");
    printAllButtons.forEach((btn, index) => {
      const rect = btn.getBoundingClientRect();
      console.log(`   Button ${index + 1}: "${btn.textContent?.trim()}" at ${rect.top.toFixed(0)}px`);
      console.log(`     Parent: ${btn.parentElement?.className}`);
    });
  } else if (printAllButtons.length === 1) {
    console.log("✅ Only one Print All Carts button found (as expected)");
  } else {
    console.log("❌ No Print All Carts buttons found");
  }
};

console.log("\n🎯 Available functions:");
console.log("• testPrintButtonPosition() - Complete position analysis");
console.log("• checkForDuplicatePrintButtons() - Quick duplicate check");

console.log("\n📋 Instructions:");
console.log("1. Ensure invoice details modal is open with multiple carts");
console.log("2. Run testPrintButtonPosition() for detailed analysis");
console.log("3. Check console output to identify positioning issues");

// Auto-run duplicate check
setTimeout(() => {
  console.log("\n🔍 Auto-running duplicate check...");
  window.checkForDuplicatePrintButtons();
}, 500);
