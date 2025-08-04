/**
 * Test Script for Instant Print Status Updates
 * 
 * This script tests the newly implemented instant print status updates
 * that show the "1/1 printed" and "PRINTED" label immediately after
 * printing a cart without requiring a page refresh.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5174
 * 2. Navigate to an invoice with carts
 * 3. Open the invoice details modal
 * 4. Open browser console (F12)
 * 5. Paste this script and press Enter
 * 6. Run: testInstantPrintStatusUpdates()
 */

console.log("🖨️ Instant Print Status Updates Test Script Loaded");

/**
 * Test the instant print status update functionality
 */
window.testInstantPrintStatusUpdates = function() {
  console.log("🚀 Testing Instant Print Status Updates...");
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
  
  // Look for print status indicators
  const statusIndicators = document.querySelectorAll('[style*="backgroundColor"]');
  const printCounters = document.querySelectorAll('.text-muted');
  
  console.log(`🔍 Found ${statusIndicators.length} status indicators`);
  console.log(`📊 Found ${printCounters.length} potential print counters`);
  
  // Check current print status
  let printCounter = null;
  printCounters.forEach(counter => {
    if (counter.textContent && counter.textContent.includes('/') && counter.textContent.includes('printed')) {
      printCounter = counter;
      console.log(`📈 Current print status: "${counter.textContent}"`);
    }
  });
  
  if (!printCounter) {
    console.log("⚠️ Print counter not found. Looking for shipping readiness indicator...");
    
    // Try to find the shipping readiness indicator
    const readinessIndicators = document.querySelectorAll('.badge');
    readinessIndicators.forEach(badge => {
      if (badge.textContent && (badge.textContent.includes('printed') || badge.textContent.includes('Ready to Ship'))) {
        console.log(`📊 Found readiness indicator: "${badge.textContent}"`);
      }
    });
  }
  
  // Look for cart print buttons
  const printButtons = document.querySelectorAll('[title="Print Cart"]');
  console.log(`🖨️ Found ${printButtons.length} cart print buttons`);
  
  if (printButtons.length === 0) {
    console.log("❌ No cart print buttons found.");
    return;
  }
  
  // Check cart status indicators
  console.log("\n🏷️ Cart Status Analysis:");
  cartSections.forEach((section, index) => {
    const cartName = section.querySelector('h3')?.textContent;
    const statusIndicator = section.querySelector('[style*="backgroundColor"]');
    
    if (statusIndicator) {
      const statusText = statusIndicator.textContent;
      const statusColor = statusIndicator.style.backgroundColor;
      console.log(`   Cart ${index + 1} (${cartName}): ${statusText} (${statusColor})`);
    } else {
      console.log(`   Cart ${index + 1} (${cartName}): No status indicator found`);
    }
  });
  
  console.log("\n🧪 TESTING INSTRUCTIONS:");
  console.log("1. Note the current print status above");
  console.log("2. Click a cart print button");
  console.log("3. In the print modal, click 'Print Cart' (any format)");
  console.log("4. After the print window closes, check:");
  console.log("   ✅ The cart status should change to 'PRINTED' with green background");
  console.log("   ✅ The print counter should update (e.g., '0/1 printed' → '1/1 printed')");
  console.log("   ✅ The readiness badge should update instantly");
  console.log("   ✅ No page refresh should be required");
  
  console.log("\n📝 Run printStatusSnapshot() before and after printing to compare");
};

/**
 * Take a snapshot of current print status
 */
window.printStatusSnapshot = function() {
  console.log("\n📸 Print Status Snapshot:");
  console.log("=" .repeat(40));
  
  // Print counter
  const printCounters = document.querySelectorAll('.text-muted');
  printCounters.forEach(counter => {
    if (counter.textContent && counter.textContent.includes('/') && counter.textContent.includes('printed')) {
      console.log(`📊 Print Counter: "${counter.textContent}"`);
    }
  });
  
  // Readiness badge
  const badges = document.querySelectorAll('.badge');
  badges.forEach(badge => {
    if (badge.textContent && (badge.textContent.includes('printed') || badge.textContent.includes('Ready') || badge.textContent.includes('need'))) {
      console.log(`🏷️ Readiness Badge: "${badge.textContent}"`);
    }
  });
  
  // Individual cart statuses
  const cartSections = document.querySelectorAll('.cart-section');
  cartSections.forEach((section, index) => {
    const cartName = section.querySelector('h3')?.textContent?.trim();
    const statusIndicator = section.querySelector('[style*="backgroundColor"]');
    
    if (statusIndicator) {
      const statusText = statusIndicator.textContent?.trim();
      console.log(`🛒 Cart ${index + 1} "${cartName}": ${statusText}`);
    }
  });
  
  console.log("=" .repeat(40));
};

/**
 * Auto-test print status by monitoring changes
 */
window.monitorPrintStatusChanges = function() {
  console.log("🔍 Starting print status change monitoring...");
  console.log("Print any cart to see instant updates!");
  
  let lastStatus = {};
  
  const checkStatus = () => {
    const currentStatus = {};
    
    // Get current print counter
    const printCounters = document.querySelectorAll('.text-muted');
    printCounters.forEach(counter => {
      if (counter.textContent && counter.textContent.includes('/') && counter.textContent.includes('printed')) {
        currentStatus.printCounter = counter.textContent;
      }
    });
    
    // Get readiness badge
    const badges = document.querySelectorAll('.badge');
    badges.forEach(badge => {
      if (badge.textContent && (badge.textContent.includes('printed') || badge.textContent.includes('Ready') || badge.textContent.includes('need'))) {
        currentStatus.readinessBadge = badge.textContent;
      }
    });
    
    // Check for changes
    if (JSON.stringify(currentStatus) !== JSON.stringify(lastStatus)) {
      console.log("🔄 Status Change Detected:");
      console.log(`   Print Counter: ${lastStatus.printCounter} → ${currentStatus.printCounter}`);
      console.log(`   Readiness Badge: ${lastStatus.readinessBadge} → ${currentStatus.readinessBadge}`);
      lastStatus = { ...currentStatus };
    }
  };
  
  // Take initial snapshot
  checkStatus();
  
  // Monitor every 500ms
  const monitorInterval = setInterval(checkStatus, 500);
  
  // Stop monitoring after 2 minutes
  setTimeout(() => {
    clearInterval(monitorInterval);
    console.log("⏹️ Print status monitoring stopped");
  }, 120000);
  
  console.log("ℹ️ Monitoring will run for 2 minutes...");
  
  return monitorInterval;
};

console.log("\n🎯 Available functions:");
console.log("• testInstantPrintStatusUpdates() - Complete analysis and test instructions");
console.log("• printStatusSnapshot() - Take current status snapshot");
console.log("• monitorPrintStatusChanges() - Automatic change detection");

console.log("\n📋 Quick Start:");
console.log("1. Ensure invoice details modal is open with carts");
console.log("2. Run printStatusSnapshot() to see current status");
console.log("3. Print a cart using the print button");
console.log("4. Run printStatusSnapshot() again to verify instant updates");

// Auto-run initial test
setTimeout(() => {
  console.log("\n🔍 Auto-running initial analysis...");
  window.testInstantPrintStatusUpdates();
}, 500);
