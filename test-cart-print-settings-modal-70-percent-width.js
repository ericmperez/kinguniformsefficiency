/**
 * Test Script for Cart Print Settings Modal 70% Width
 * 
 * This script verifies that the Cart Print Settings modal (PrintConfigModal) 
 * is correctly sized at 70% of the screen width as requested.
 * 
 * USAGE:
 * 1. Navigate to Settings → 🖨️ Printing section
 * 2. Find a client in the table
 * 3. Click the "Cart Print Settings" button for any client
 * 4. Open browser console (F12)
 * 5. Paste this script and press Enter
 * 6. Run: verifyModalSize()
 */

console.log("🖨️ Cart Print Settings Modal Size Test Script Loaded");

/**
 * Verify the modal size is 70% of screen width
 */
window.verifyModalSize = function() {
  console.log("🚀 Verifying Cart Print Settings modal size...");
  console.log("=" .repeat(60));
  
  // Check if the Print Configuration modal is open
  const modal = document.querySelector('.modal.show');
  if (!modal) {
    console.log("❌ No modal is currently open.");
    console.log("Please open the Cart Print Settings modal first:");
    console.log("1. Go to Settings → 🖨️ Printing");
    console.log("2. Click 'Cart Print Settings' button for any client");
    return;
  }
  
  // Check for the specific PrintConfigModal
  const modalDialog = modal.querySelector('.modal-dialog');
  const modalTitle = modal.querySelector('.modal-title');
  
  if (!modalDialog) {
    console.log("❌ Modal dialog not found");
    return;
  }
  
  // Verify it's the Print Configuration modal
  const titleText = modalTitle ? modalTitle.textContent : '';
  if (!titleText.includes('Print Configuration')) {
    console.log("❌ This is not the Print Configuration modal");
    console.log(`Found modal: "${titleText}"`);
    return;
  }
  
  console.log("✅ Print Configuration modal detected");
  console.log(`📝 Modal title: "${titleText}"`);
  
  // Get modal dimensions
  const modalRect = modalDialog.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate percentages
  const modalWidthPercent = (modalRect.width / viewportWidth * 100).toFixed(1);
  const modalHeightPercent = (modalRect.height / viewportHeight * 100).toFixed(1);
  
  // Get computed styles
  const computedStyle = window.getComputedStyle(modalDialog);
  
  console.log("\n📐 Modal Size Analysis:");
  console.log("─".repeat(40));
  console.log(`Viewport: ${viewportWidth}px × ${viewportHeight}px`);
  console.log(`Modal: ${modalRect.width.toFixed(0)}px × ${modalRect.height.toFixed(0)}px`);
  console.log(`Width Percentage: ${modalWidthPercent}% (Target: 70%)`);
  console.log(`Height Percentage: ${modalHeightPercent}% (Target: ~96%)`);
  
  console.log("\n🎨 Style Properties:");
  console.log("─".repeat(40));
  console.log(`Max Width: ${computedStyle.maxWidth}`);
  console.log(`Width: ${computedStyle.width}`);
  console.log(`Min Width: ${computedStyle.minWidth}`);
  console.log(`Height: ${computedStyle.height}`);
  console.log(`Margin: ${computedStyle.margin}`);
  
  // Verify the size is close to 70%
  const targetWidth = 70;
  const tolerance = 2; // Allow 2% tolerance
  const isCorrectSize = Math.abs(parseFloat(modalWidthPercent) - targetWidth) <= tolerance;
  
  console.log("\n✅ Size Verification:");
  console.log("─".repeat(40));
  if (isCorrectSize) {
    console.log(`✅ PASS: Modal width is ${modalWidthPercent}% (within ${tolerance}% of target 70%)`);
  } else {
    console.log(`❌ FAIL: Modal width is ${modalWidthPercent}% (should be ~70%)`);
  }
  
  // Check if minimum width constraint is active
  const minWidthActive = modalRect.width >= 800;
  console.log(`✅ Minimum width constraint: ${minWidthActive ? 'ACTIVE' : 'INACTIVE'} (800px)`);
  
  // Check for content sections
  const cartSettings = modal.querySelector('[data-testid="cart-settings"], .card-header:contains("Cart Print Settings")');
  const invoiceSettings = modal.querySelector('[data-testid="invoice-settings"], .card-header:contains("Laundry Ticket Print Settings")');
  const emailSettings = modal.querySelector('[data-testid="email-settings"], .card:contains("Email Settings")');
  
  console.log("\n📋 Content Sections:");
  console.log("─".repeat(40));
  console.log(`Cart Print Settings: ${cartSettings ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`Laundry Ticket Settings: ${invoiceSettings ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`Email Settings: ${emailSettings ? '✅ FOUND' : '❌ MISSING'}`);
  
  // Check for toggle switches mentioned in the issue
  const cartEnabledToggle = modal.querySelector('#cartEnabled, input[id*="cartEnabled"]');
  const invoiceEnabledToggle = modal.querySelector('#invoiceEnabled, input[id*="invoiceEnabled"]');
  
  console.log("\n🔄 Main Toggle Switches:");
  console.log("─".repeat(40));
  console.log(`Enable cart printing: ${cartEnabledToggle ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`Enable invoice printing: ${invoiceEnabledToggle ? '✅ FOUND' : '❌ MISSING'}`);
  
  if (cartEnabledToggle) {
    console.log(`  Cart printing enabled: ${cartEnabledToggle.checked ? 'YES' : 'NO'}`);
  }
  if (invoiceEnabledToggle) {
    console.log(`  Invoice printing enabled: ${invoiceEnabledToggle.checked ? 'YES' : 'NO'}`);
  }
  
  console.log("\n" + "=" .repeat(60));
  console.log("🎉 MODAL SIZE VERIFICATION COMPLETE");
  
  if (isCorrectSize) {
    console.log("\n✅ SUCCESS: The Cart Print Settings modal is correctly sized at 70% screen width!");
    console.log("The modal should appear large and easy to read on your screen.");
  } else {
    console.log("\n❌ ISSUE DETECTED: Modal size is not 70% as expected.");
    console.log("This might indicate a CSS conflict or browser zoom settings.");
  }
};

/**
 * Quick modal checker - run this to see if the modal is open
 */
window.checkModalStatus = function() {
  const modal = document.querySelector('.modal.show');
  const modalTitle = modal ? modal.querySelector('.modal-title')?.textContent : 'No modal open';
  
  console.log("📊 Quick Modal Status:");
  console.log(`   • Modal open: ${!!modal}`);
  console.log(`   • Modal title: "${modalTitle}"`);
  
  if (modal) {
    const modalDialog = modal.querySelector('.modal-dialog');
    if (modalDialog) {
      const rect = modalDialog.getBoundingClientRect();
      const widthPercent = (rect.width / window.innerWidth * 100).toFixed(1);
      console.log(`   • Current width: ${widthPercent}% of screen`);
    }
  }
};

console.log("\n🎯 Available functions:");
console.log("• verifyModalSize() - Complete size verification");
console.log("• checkModalStatus() - Quick modal status check");

console.log("\n📋 Instructions:");
console.log("1. Go to Settings → 🖨️ Printing");
console.log("2. Click 'Cart Print Settings' for any client");
console.log("3. Run verifyModalSize() to check the size");

console.log("\n💡 Expected Result:");
console.log("The modal should be ~70% of your screen width and contain:");
console.log("- Cart Print Settings section (left side)");
console.log("- Laundry Ticket Print Settings section (right side)");
console.log("- Email Settings section (bottom)");
console.log("- Toggle switches for enabling cart and invoice printing");
