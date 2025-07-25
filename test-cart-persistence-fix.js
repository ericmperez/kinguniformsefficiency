/**
 * Enhanced Cart Persistence Testing Script
 * 
 * This script provides comprehensive testing and debugging for cart name persistence issues.
 * Use this in the browser console after opening an invoice details modal.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5175
 * 2. Click on an invoice to open the details modal
 * 3. Open browser developer tools (F12)
 * 4. Paste this entire script into the console and press Enter
 * 5. Use the provided functions to test cart editing
 */

console.log("🛠️ Cart Persistence Testing Script Loaded");
console.log("📋 Available functions:");
console.log("  - testCartEditing() - Comprehensive cart editing test");
console.log("  - monitorCartChanges() - Monitor real-time cart updates");
console.log("  - debugModalState() - Check modal component state");
console.log("  - forceModalRerender() - Force modal re-render");

// Global monitoring variables
window.cartTestMonitor = {
  originalNames: new Map(),
  updateCount: 0,
  lastUpdate: null
};

/**
 * Monitor cart name changes in real-time
 */
window.monitorCartChanges = function() {
  console.log("🔍 Starting cart change monitoring...");
  
  // Store original cart names
  const cartElements = document.querySelectorAll('h3[style*="color: rgb(14, 98, 160)"], h3[style*="color: red"]');
  cartElements.forEach((element, index) => {
    const cartName = element.textContent.replace(/\(r:\d+\)/, '').trim();
    window.cartTestMonitor.originalNames.set(index, cartName);
    console.log(`📝 Original cart ${index + 1}: "${cartName}"`);
  });
  
  // Set up mutation observer to watch for changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const target = mutation.target;
        if (target.tagName === 'H3' || target.parentElement?.tagName === 'H3') {
          window.cartTestMonitor.updateCount++;
          window.cartTestMonitor.lastUpdate = new Date().toISOString();
          console.log(`🔄 Cart name UI update detected (#${window.cartTestMonitor.updateCount}):`, {
            timestamp: window.cartTestMonitor.lastUpdate,
            element: target,
            newContent: target.textContent || target.parentElement?.textContent
          });
        }
      }
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  console.log("✅ Cart change monitoring active");
  
  // Store observer for cleanup
  window.cartTestMonitor.observer = observer;
};

/**
 * Test cart editing functionality
 */
window.testCartEditing = function() {
  console.log("🧪 Starting comprehensive cart editing test...");
  
  const cartElements = document.querySelectorAll('h3[style*="color: rgb(14, 98, 160)"], h3[style*="color: red"]');
  
  if (cartElements.length === 0) {
    console.error("❌ No cart elements found. Make sure an invoice details modal is open.");
    return;
  }
  
  console.log(`📊 Found ${cartElements.length} cart(s) to test`);
  
  cartElements.forEach((cartElement, index) => {
    const originalName = cartElement.textContent.replace(/\(r:\d+\)/, '').trim();
    console.log(`\n🎯 Testing cart ${index + 1}: "${originalName}"`);
    
    // Find the edit button for this cart
    const editButton = cartElement.closest('.cart-section')?.querySelector('button[title="Edit Cart Name"]');
    
    if (!editButton) {
      console.error(`❌ Edit button not found for cart ${index + 1}`);
      return;
    }
    
    console.log(`🔧 Edit button found for cart ${index + 1}`);
    
    // Store test data
    const testName = `TEST_CART_${Date.now()}_${index + 1}`;
    window.cartTestMonitor[`testCart${index + 1}`] = {
      originalName,
      testName,
      element: cartElement,
      editButton
    };
    
    console.log(`📝 Test will rename "${originalName}" to "${testName}"`);
  });
  
  console.log("\n💡 Use simulateCartEdit(cartNumber) to test editing specific carts");
  console.log("   Example: simulateCartEdit(1)");
};

/**
 * Simulate cart editing for a specific cart
 */
window.simulateCartEdit = function(cartNumber) {
  const testData = window.cartTestMonitor[`testCart${cartNumber}`];
  
  if (!testData) {
    console.error(`❌ No test data found for cart ${cartNumber}. Run testCartEditing() first.`);
    return;
  }
  
  console.log(`🚀 Simulating cart edit for cart ${cartNumber}...`);
  console.log(`📝 Changing "${testData.originalName}" to "${testData.testName}"`);
  
  // Override prompt to return our test name
  const originalPrompt = window.prompt;
  window.prompt = function(message, defaultValue) {
    console.log(`📞 Prompt intercepted: "${message}" (default: "${defaultValue}")`);
    console.log(`🔄 Returning test name: "${testData.testName}"`);
    return testData.testName;
  };
  
  // Record time before click
  const startTime = performance.now();
  
  // Click the edit button
  testData.editButton.click();
  
  // Restore original prompt after a delay
  setTimeout(() => {
    window.prompt = originalPrompt;
    console.log("✅ Original prompt function restored");
  }, 1000);
  
  // Monitor for changes
  const checkInterval = setInterval(() => {
    const currentName = testData.element.textContent.replace(/\(r:\d+\)/, '').trim();
    const elapsed = performance.now() - startTime;
    
    if (currentName === testData.testName) {
      clearInterval(checkInterval);
      console.log(`🎉 SUCCESS! Cart name updated to "${currentName}" in ${elapsed.toFixed(2)}ms`);
    } else if (elapsed > 10000) { // 10 second timeout
      clearInterval(checkInterval);
      console.error(`⏰ TIMEOUT! Cart name still shows "${currentName}" after 10 seconds`);
      console.error("❌ Cart persistence issue confirmed - name did not update in UI");
    }
  }, 100);
};

/**
 * Debug modal component state
 */
window.debugModalState = function() {
  console.log("🔍 Debugging modal component state...");
  
  // Look for React component data
  const modalElement = document.querySelector('.modal.show');
  if (!modalElement) {
    console.error("❌ No modal found");
    return;
  }
  
  // Get React fiber node
  const fiberKey = Object.keys(modalElement).find(key => key.startsWith('__reactFiber'));
  const fiber = fiberKey ? modalElement[fiberKey] : null;
  
  if (fiber) {
    console.log("⚛️ React fiber found:", fiber);
    console.log("📊 Component state:", fiber.memoizedState);
    console.log("🎯 Component props:", fiber.memoizedProps);
  } else {
    console.log("⚠️ React fiber not accessible");
  }
  
  // Check for cart elements
  const cartElements = document.querySelectorAll('.cart-section');
  console.log(`📦 Found ${cartElements.length} cart sections`);
  
  cartElements.forEach((cartSection, index) => {
    const nameElement = cartSection.querySelector('h3');
    const name = nameElement ? nameElement.textContent.replace(/\(r:\d+\)/, '').trim() : 'Unknown';
    console.log(`🏷️ Cart ${index + 1}: "${name}"`);
  });
};

/**
 * Force modal re-render by triggering React updates
 */
window.forceModalRerender = function() {
  console.log("🔄 Attempting to force modal re-render...");
  
  // Try to trigger React updates
  const modalElement = document.querySelector('.modal.show');
  if (!modalElement) {
    console.error("❌ No modal found");
    return;
  }
  
  // Dispatch custom events that might trigger updates
  modalElement.dispatchEvent(new CustomEvent('forceUpdate'));
  
  // Try to trigger re-render by changing DOM temporarily
  const originalDisplay = modalElement.style.display;
  modalElement.style.display = 'none';
  
  setTimeout(() => {
    modalElement.style.display = originalDisplay;
    console.log("✅ Modal display toggled - this might trigger re-render");
  }, 50);
};

/**
 * Clean up monitoring
 */
window.stopCartMonitoring = function() {
  if (window.cartTestMonitor.observer) {
    window.cartTestMonitor.observer.disconnect();
    console.log("🛑 Cart monitoring stopped");
  }
};

// Auto-start monitoring
window.monitorCartChanges();

console.log("\n🎯 QUICK START:");
console.log("1. testCartEditing() - Analyze available carts");
console.log("2. simulateCartEdit(1) - Test editing the first cart");
console.log("3. debugModalState() - Check component state");
console.log("\n🔧 The script is now ready for testing!");
