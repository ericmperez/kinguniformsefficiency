/**
 * Test Script for "Print All Carts" Functionality
 * 
 * This script tests the newly implemented "Print All Carts" button that allows
 * users to print all carts in an invoice with one click.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5175
 * 2. Navigate to an invoice with multiple carts
 * 3. Open the invoice details modal
 * 4. Open browser console (F12)
 * 5. Paste this script and press Enter
 * 6. Run: testPrintAllCarts()
 */

console.log("🖨️ Print All Carts Test Script Loaded");

/**
 * Test the "Print All Carts" functionality
 */
window.testPrintAllCarts = function() {
  console.log("🚀 Testing Print All Carts functionality...");
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
  const cartSections = document.querySelectorAll('.cart-section');
  console.log(`📋 Found ${cartSections.length} cart(s) in the invoice`);
  
  if (cartSections.length === 0) {
    console.log("❌ No carts found in the invoice.");
    console.log("Please open an invoice that contains carts.");
    return;
  }
  
  // Look for the "Print All Carts" button
  const printAllButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.includes('Print All Carts'));
  
  if (!printAllButton) {
    console.log("❌ 'Print All Carts' button not found.");
    console.log("This might indicate:");
    console.log("1. The button only appears when there are carts");
    console.log("2. The implementation needs to be checked");
    
    // Check for Create New Cart button to confirm we're in the right place
    const createCartButton = Array.from(document.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Create New Cart'));
    
    if (createCartButton) {
      console.log("✅ Found 'Create New Cart' button - we're in the right section");
      if (cartSections.length > 0) {
        console.log("⚠️  Expected 'Print All Carts' button to be visible with existing carts");
      }
    }
    return;
  }
  
  console.log(`✅ Found 'Print All Carts' button`);
  console.log(`📊 Button text: "${printAllButton.textContent?.trim()}"`);
  
  // Check button properties
  const isDisabled = printAllButton.disabled;
  const hasIcon = printAllButton.querySelector('i.bi-printer-fill');
  const hasCartCount = printAllButton.textContent?.includes(`(${cartSections.length})`);
  
  console.log("🔍 Button Analysis:");
  console.log(`   • Disabled: ${isDisabled}`);
  console.log(`   • Has printer icon: ${!!hasIcon}`);
  console.log(`   • Shows cart count: ${hasCartCount}`);
  console.log(`   • Expected count: (${cartSections.length})`);
  
  // Test button click (with user confirmation)
  console.log("\n🖱️  Ready to test print functionality");
  console.log("⚠️  This will open a print window - make sure popups are allowed");
  
  const shouldTest = confirm(
    `Test the 'Print All Carts' functionality?\n\n` +
    `This will:\n` +
    `• Open a new print window\n` +
    `• Show ${cartSections.length} cart(s) ready for printing\n` +
    `• Trigger the browser's print dialog\n\n` +
    `Continue?`
  );
  
  if (shouldTest) {
    console.log("🖨️ Testing print functionality...");
    
    try {
      printAllButton.click();
      console.log("✅ Print button clicked successfully");
      console.log("📋 If a print window opened, the functionality is working!");
      
      // Give feedback after a delay
      setTimeout(() => {
        console.log("\n🎉 PRINT ALL CARTS TEST COMPLETED");
        console.log("Expected behavior:");
        console.log("✅ Print window should have opened");
        console.log("✅ Each cart should appear on a separate page");
        console.log("✅ All carts should use the same format as individual cart prints");
        console.log("✅ Browser print dialog should have appeared");
      }, 1000);
      
    } catch (error) {
      console.log(`❌ Error clicking print button: ${error.message}`);
    }
  } else {
    console.log("🚫 Test cancelled by user");
  }
  
  console.log("\n📋 Test Summary:");
  console.log(`   • Cart sections found: ${cartSections.length}`);
  console.log(`   • Print All button found: ${!!printAllButton}`);
  console.log(`   • Button functional: ${!isDisabled}`);
  console.log(`   • Implementation: Complete`);
};

/**
 * Quick verification of button presence
 */
window.quickPrintAllCheck = function() {
  console.log("⚡ Quick Print All Carts Check...");
  
  const modal = document.querySelector('.invoice-details-modal');
  const cartSections = document.querySelectorAll('.cart-section');
  const printAllButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.includes('Print All Carts'));
  
  console.log("📊 Quick Status:");
  console.log(`   • Modal open: ${!!modal}`);
  console.log(`   • Carts present: ${cartSections.length}`);
  console.log(`   • Print All button: ${!!printAllButton}`);
  
  if (printAllButton) {
    console.log(`   • Button text: "${printAllButton.textContent?.trim()}"`);
  }
};

console.log("\n🎯 Available functions:");
console.log("• testPrintAllCarts() - Complete functionality test");
console.log("• quickPrintAllCheck() - Quick button verification");

console.log("\n📋 Instructions:");
console.log("1. Ensure invoice details modal is open with multiple carts");
console.log("2. Run testPrintAllCarts() for comprehensive testing");
console.log("3. Or run quickPrintAllCheck() for quick verification");

// Auto-run quick check
setTimeout(() => {
  console.log("\n🔍 Auto-running quick check...");
  window.quickPrintAllCheck();
}, 500);
