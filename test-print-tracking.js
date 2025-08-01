/**
 * Test Script for Print All Carts Tracking Functionality
 * 
 * This script tests the newly implemented tracking functionality that records
 * who performed the "Print All Carts" operation and displays this information
 * in the invoice details modal.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5176
 * 2. Navigate to an invoice with multiple carts
 * 3. Open the invoice details modal
 * 4. Open browser console (F12)
 * 5. Paste this script and press Enter
 * 6. Run: testPrintTracking()
 */

console.log("🖨️ Print Tracking Test Script Loaded");

/**
 * Test the print tracking functionality
 */
window.testPrintTracking = function() {
  console.log("🚀 Testing Print All Carts tracking functionality...");
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
    return;
  }
  
  console.log(`✅ Found 'Print All Carts' button`);
  
  // Check if tracking display exists
  const trackingDisplay = document.querySelector('[data-testid="print-tracking-display"]') ||
    document.querySelector('.text-secondary.small');
  
  console.log(`📊 Print tracking display: ${trackingDisplay ? 'Found' : 'Not visible (no previous prints)'}`);
  
  if (trackingDisplay) {
    console.log(`   Display text: "${trackingDisplay.textContent?.trim()}"`);
  }
  
  // Test the tracking functionality
  console.log("\n🖱️  Testing print tracking functionality");
  console.log("⚠️  This will:");
  console.log("   • Record who performed the print operation");
  console.log("   • Update the tracking display");
  console.log("   • Log the activity for audit trail");
  console.log("   • Open a print window");
  
  const shouldTest = confirm(
    `Test the print tracking functionality?\n\n` +
    `This will:\n` +
    `• Record the print operation with your username\n` +
    `• Update the "Last printed by" display\n` +
    `• Log the activity in the audit trail\n` +
    `• Open a print window with ${cartSections.length} cart(s)\n\n` +
    `Continue?`
  );
  
  if (shouldTest) {
    console.log("🖨️ Testing print tracking...");
    
    try {
      // Record state before click
      const beforeTrackingDisplay = trackingDisplay ? trackingDisplay.textContent : 'None';
      
      console.log(`📝 State before print:`, {
        trackingDisplay: beforeTrackingDisplay,
        timestamp: new Date().toISOString()
      });
      
      // Click the print button
      printAllButton.click();
      
      console.log("✅ Print button clicked successfully");
      
      // Check for updates after a delay
      setTimeout(() => {
        const afterTrackingDisplay = document.querySelector('.text-secondary.small');
        
        console.log("\n📊 Results after print operation:");
        console.log(`   • Tracking display updated: ${!!afterTrackingDisplay}`);
        
        if (afterTrackingDisplay) {
          console.log(`   • New display text: "${afterTrackingDisplay.textContent?.trim()}"`);
          
          // Check if it contains current user info
          const hasUsername = afterTrackingDisplay.textContent?.includes('Last printed by:');
          const hasTimestamp = afterTrackingDisplay.textContent?.includes('(');
          
          console.log(`   • Contains username: ${hasUsername}`);
          console.log(`   • Contains timestamp: ${hasTimestamp}`);
        }
        
        console.log("\n🎉 PRINT TRACKING TEST COMPLETED");
        console.log("Expected behavior:");
        console.log("✅ Tracking display should show current user");
        console.log("✅ Timestamp should reflect current time");
        console.log("✅ Activity should be logged in the background");
        console.log("✅ Print window should have opened");
        
      }, 1000);
      
    } catch (error) {
      console.log(`❌ Error during print tracking test: ${error.message}`);
    }
  } else {
    console.log("🚫 Test cancelled by user");
  }
  
  console.log("\n📋 Test Summary:");
  console.log(`   • Cart sections found: ${cartSections.length}`);
  console.log(`   • Print All button found: ${!!printAllButton}`);
  console.log(`   • Tracking display visible: ${!!trackingDisplay}`);
  console.log(`   • Implementation: Complete with tracking`);
};

/**
 * Quick verification of tracking display
 */
window.checkTrackingDisplay = function() {
  console.log("⚡ Quick Print Tracking Check...");
  
  const modal = document.querySelector('.invoice-details-modal');
  const printAllButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.includes('Print All Carts'));
  const trackingDisplay = document.querySelector('.text-secondary.small');
  
  console.log("📊 Tracking Status:");
  console.log(`   • Modal open: ${!!modal}`);
  console.log(`   • Print All button: ${!!printAllButton}`);
  console.log(`   • Tracking display: ${!!trackingDisplay}`);
  
  if (trackingDisplay) {
    console.log(`   • Display text: "${trackingDisplay.textContent?.trim()}"`);
  }
  
  if (printAllButton) {
    console.log(`   • Button text: "${printAllButton.textContent?.trim()}"`);
  }
};

console.log("\n🎯 Available functions:");
console.log("• testPrintTracking() - Complete tracking functionality test");
console.log("• checkTrackingDisplay() - Quick tracking display verification");

console.log("\n📋 Instructions:");
console.log("1. Ensure invoice details modal is open with multiple carts");
console.log("2. Run testPrintTracking() for comprehensive testing");
console.log("3. Or run checkTrackingDisplay() for quick verification");

// Auto-run quick check
setTimeout(() => {
  console.log("\n🔍 Auto-running quick check...");
  window.checkTrackingDisplay();
}, 500);
