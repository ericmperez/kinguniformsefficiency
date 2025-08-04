/**
 * Test Script: Immediate UI Updates for Cart Modifications
 * 
 * This script tests that when items are added to carts, the changes are
 * visible immediately without requiring window refresh or modal reopening.
 * 
 * Test Cases:
 * 1. Keypad product addition - immediate local state update
 * 2. Direct product addition via modal - immediate modal state update
 * 3. Reprint flag setting - needsReprint should be true immediately
 * 4. Status changes visible in main list and modal simultaneously
 */

console.log("🧪 Starting Immediate UI Updates Test");

// Test configuration
const TEST_CONFIG = {
  // Wait times for DOM updates
  DOM_UPDATE_DELAY: 100,
  STATE_UPDATE_DELAY: 500,
  
  // Test selectors (adjust based on actual DOM structure)
  SELECTORS: {
    invoiceRow: '[data-testid="invoice-row"]',
    invoiceDetailsModal: '[data-testid="invoice-details-modal"]',
    cartItem: '[data-testid="cart-item"]',
    reprintStatus: '[data-testid="reprint-status"]',
    keypadButton: '[data-testid="keypad-button"]',
    addProductButton: '[data-testid="add-product-button"]',
    productSelector: '[data-testid="product-selector"]',
    quantityInput: '[data-testid="quantity-input"]',
  }
};

// Utility functions
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logStep = (step, description) => {
  console.log(`📋 Step ${step}: ${description}`);
};

const logResult = (result, expected, actual) => {
  const status = result ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} Expected: ${expected}, Actual: ${actual}`);
};

// Test helper functions
const getReprintStatus = (invoiceElement) => {
  const reprintElement = invoiceElement.querySelector(TEST_CONFIG.SELECTORS.reprintStatus);
  return reprintElement ? reprintElement.textContent.includes('reprint') : false;
};

const getCartItemCount = (cartElement) => {
  const items = cartElement.querySelectorAll(TEST_CONFIG.SELECTORS.cartItem);
  return items.length;
};

const simulateProductAddition = async (method = 'keypad') => {
  logStep('SIM', `Simulating product addition via ${method}`);
  
  if (method === 'keypad') {
    // Simulate keypad addition
    const keypadButton = document.querySelector(TEST_CONFIG.SELECTORS.keypadButton);
    if (keypadButton) {
      keypadButton.click();
      await wait(TEST_CONFIG.DOM_UPDATE_DELAY);
      return true;
    }
  } else if (method === 'direct') {
    // Simulate direct addition in modal
    const addButton = document.querySelector(TEST_CONFIG.SELECTORS.addProductButton);
    if (addButton) {
      addButton.click();
      await wait(TEST_CONFIG.DOM_UPDATE_DELAY);
      return true;
    }
  }
  
  return false;
};

// Main test functions
const testKeypadAdditionUIUpdate = async () => {
  logStep(1, "Testing keypad addition immediate UI update");
  
  try {
    // Get initial state
    const invoiceRows = document.querySelectorAll(TEST_CONFIG.SELECTORS.invoiceRow);
    if (invoiceRows.length === 0) {
      console.log("❌ No invoices found for testing");
      return false;
    }
    
    const firstInvoice = invoiceRows[0];
    const initialReprintStatus = getReprintStatus(firstInvoice);
    
    logStep('1a', `Initial reprint status: ${initialReprintStatus}`);
    
    // Simulate adding product via keypad
    const additionSuccess = await simulateProductAddition('keypad');
    if (!additionSuccess) {
      console.log("❌ Could not simulate keypad addition");
      return false;
    }
    
    // Check immediate UI update (without waiting for network)
    await wait(TEST_CONFIG.DOM_UPDATE_DELAY);
    const updatedReprintStatus = getReprintStatus(firstInvoice);
    
    logResult(
      updatedReprintStatus !== initialReprintStatus,
      "Reprint status changed immediately",
      `Status changed: ${updatedReprintStatus !== initialReprintStatus}`
    );
    
    return updatedReprintStatus !== initialReprintStatus;
    
  } catch (error) {
    console.error("❌ Error in keypad addition test:", error);
    return false;
  }
};

const testDirectAdditionUIUpdate = async () => {
  logStep(2, "Testing direct addition immediate UI update in modal");
  
  try {
    // Check if modal is open
    const modal = document.querySelector(TEST_CONFIG.SELECTORS.invoiceDetailsModal);
    if (!modal) {
      console.log("❌ Invoice details modal not open");
      return false;
    }
    
    // Get initial cart state in modal
    const initialItemCount = getCartItemCount(modal);
    logStep('2a', `Initial cart items: ${initialItemCount}`);
    
    // Simulate direct product addition
    const additionSuccess = await simulateProductAddition('direct');
    if (!additionSuccess) {
      console.log("❌ Could not simulate direct addition");
      return false;
    }
    
    // Check immediate UI update in modal
    await wait(TEST_CONFIG.DOM_UPDATE_DELAY);
    const updatedItemCount = getCartItemCount(modal);
    
    logResult(
      updatedItemCount > initialItemCount,
      "Cart items increased immediately",
      `Items: ${initialItemCount} → ${updatedItemCount}`
    );
    
    return updatedItemCount > initialItemCount;
    
  } catch (error) {
    console.error("❌ Error in direct addition test:", error);
    return false;
  }
};

const testSynchronizedUpdates = async () => {
  logStep(3, "Testing synchronized updates between main list and modal");
  
  try {
    // This test checks that changes are visible in both the main invoice list
    // and the open modal simultaneously
    
    const invoiceRows = document.querySelectorAll(TEST_CONFIG.SELECTORS.invoiceRow);
    const modal = document.querySelector(TEST_CONFIG.SELECTORS.invoiceDetailsModal);
    
    if (invoiceRows.length === 0 || !modal) {
      console.log("❌ Missing required elements for synchronization test");
      return false;
    }
    
    // Get timestamps of last updates
    const getLastModified = (element) => {
      const timestampElement = element.querySelector('[data-timestamp]');
      return timestampElement ? timestampElement.getAttribute('data-timestamp') : null;
    };
    
    const initialMainTimestamp = getLastModified(invoiceRows[0]);
    const initialModalTimestamp = getLastModified(modal);
    
    // Simulate addition
    await simulateProductAddition('keypad');
    await wait(TEST_CONFIG.STATE_UPDATE_DELAY);
    
    const updatedMainTimestamp = getLastModified(invoiceRows[0]);
    const updatedModalTimestamp = getLastModified(modal);
    
    const mainUpdated = updatedMainTimestamp !== initialMainTimestamp;
    const modalUpdated = updatedModalTimestamp !== initialModalTimestamp;
    
    logResult(
      mainUpdated && modalUpdated,
      "Both main list and modal updated",
      `Main: ${mainUpdated}, Modal: ${modalUpdated}`
    );
    
    return mainUpdated && modalUpdated;
    
  } catch (error) {
    console.error("❌ Error in synchronization test:", error);
    return false;
  }
};

// Main test execution
const runImmediateUITests = async () => {
  console.log("🚀 Starting Immediate UI Updates Test Suite");
  console.log("=" .repeat(50));
  
  const results = {
    keypadAddition: false,
    directAddition: false,
    synchronization: false
  };
  
  // Wait for page to load
  await wait(2000);
  
  // Run tests
  results.keypadAddition = await testKeypadAdditionUIUpdate();
  await wait(1000);
  
  results.directAddition = await testDirectAdditionUIUpdate();
  await wait(1000);
  
  results.synchronization = await testSynchronizedUpdates();
  
  // Summary
  console.log("\n" + "=" .repeat(50));
  console.log("🏁 Test Results Summary:");
  console.log(`Keypad Addition UI Update: ${results.keypadAddition ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Direct Addition UI Update: ${results.directAddition ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Synchronized Updates: ${results.synchronization ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log("\n🎉 Immediate UI updates are working correctly!");
    console.log("Users will see cart modifications instantly without refreshing.");
  } else {
    console.log("\n⚠️  Some UI updates may require investigation.");
  }
  
  return results;
};

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
  // Run tests when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runImmediateUITests);
  } else {
    runImmediateUITests();
  }
}

// Export for manual execution
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runImmediateUITests, testKeypadAdditionUIUpdate, testDirectAdditionUIUpdate };
}
