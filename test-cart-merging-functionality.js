/**
 * Cart Merging Functionality Test Script
 * 
 * This script tests the newly implemented cart merging feature in ActiveInvoices.tsx
 * 
 * Features tested:
 * 1. Cart creation with duplicate names shows confirmation dialog
 * 2. User can choose to merge or create separate cart
 * 3. Merge option returns existing cart ID
 * 4. Separate option creates cart with numbered suffix
 * 
 * USAGE:
 * 1. Open the application at http://localhost:5175
 * 2. Navigate to an invoice with existing carts
 * 3. Open browser developer tools (F12)
 * 4. Paste this script into the console and press Enter
 * 5. Run: testCartMerging()
 */

console.log("🧪 Cart Merging Test Script Loaded");
console.log("📋 Available functions:");
console.log("  - testCartMerging() - Test the cart merging functionality");
console.log("  - simulateCartCreation(cartName) - Simulate creating a cart with given name");

/**
 * Test the cart merging functionality
 */
window.testCartMerging = function() {
  console.log("🚀 Starting Cart Merging Functionality Test...");
  console.log("=" .repeat(60));
  
  // Check if we're in the correct context
  const cartModal = document.querySelector('.modal');
  const invoiceModal = document.querySelector('[class*="modal"]');
  
  if (!cartModal && !invoiceModal) {
    console.log("❌ No modal detected. Please:");
    console.log("1. Open an invoice to access the details modal, OR");
    console.log("2. Click 'Select/Create Cart' to open the cart selection modal");
    return;
  }
  
  console.log("✅ Modal context detected");
  
  // Look for cart creation elements
  const createCartButton = document.querySelector('button:contains("Create New Cart")') || 
                          document.querySelector('button[class*="btn-outline-primary"]') ||
                          document.querySelector('button:contains("Create")');
  
  if (!createCartButton) {
    console.log("❌ Cart creation button not found. Make sure you're in:");
    console.log("1. The cart selection modal, OR");
    console.log("2. The invoice details modal with cart creation capability");
    return;
  }
  
  console.log("✅ Cart creation capability found");
  
  // Check for existing carts
  const existingCarts = [];
  const cartElements = document.querySelectorAll('.list-group-item, .cart-section');
  
  cartElements.forEach((element, index) => {
    const cartName = element.textContent?.trim();
    if (cartName && cartName !== 'Create New Cart') {
      existingCarts.push({
        index,
        name: cartName.replace(/\(r:\d+\)/, '').trim(),
        element
      });
    }
  });
  
  console.log(`📋 Found ${existingCarts.length} existing cart(s):`);
  existingCarts.forEach(cart => {
    console.log(`  • ${cart.name}`);
  });
  
  if (existingCarts.length === 0) {
    console.log("⚠️  No existing carts found. The merge functionality works when:");
    console.log("1. You try to create a cart with the same name as an existing cart");
    console.log("2. A confirmation dialog should appear asking to merge or create separate");
    return;
  }
  
  console.log("\n🎯 Test Instructions:");
  console.log("1. Try to create a cart with the same name as an existing cart");
  console.log("2. You should see a confirmation dialog");
  console.log("3. Click 'OK' to merge items with existing cart");
  console.log("4. Click 'Cancel' to create a separate cart with numbered suffix");
  
  console.log("\n🔄 Example test:");
  console.log(`Try creating a cart named: "${existingCarts[0].name}"`);
  console.log("Expected result: Confirmation dialog asking to merge or create separate");
  
  console.log("\n✅ Cart merging functionality is ready for testing!");
};

/**
 * Simulate cart creation with a given name
 */
window.simulateCartCreation = function(cartName) {
  console.log(`🧪 Simulating cart creation with name: "${cartName}"`);
  
  // Look for the cart name input field
  const cartNameInput = document.querySelector('input[type="text"]') ||
                       document.querySelector('input[placeholder*="cart"]') ||
                       document.querySelector('input[placeholder*="Cart"]');
  
  if (!cartNameInput) {
    console.log("❌ Cart name input not found. Make sure you're in cart creation mode.");
    return;
  }
  
  // Set the cart name
  cartNameInput.value = cartName;
  cartNameInput.dispatchEvent(new Event('input', { bubbles: true }));
  cartNameInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  console.log(`✅ Cart name set to: "${cartName}"`);
  
  // Look for the submit button
  const submitButton = document.querySelector('button[type="submit"]') ||
                      document.querySelector('button:contains("Create")') ||
                      document.querySelector('button:contains("Add")');
  
  if (submitButton) {
    console.log("🖱️ Click the submit button to test the merging functionality");
    console.log("Expected: If duplicate name, confirmation dialog should appear");
  } else {
    console.log("⚠️  Submit button not found. Manually submit the form to test merging.");
  }
};

/**
 * Monitor for confirmation dialogs
 */
function monitorConfirmDialogs() {
  const originalConfirm = window.confirm;
  
  window.confirm = function(message) {
    console.log("🔔 Confirmation dialog detected:");
    console.log(`Message: "${message}"`);
    
    if (message.includes("already exists")) {
      console.log("✅ Cart merging dialog confirmed!");
      console.log("🎯 This is the expected behavior for duplicate cart names");
    }
    
    // Call original confirm to maintain functionality
    return originalConfirm.call(this, message);
  };
  
  console.log("👁️  Now monitoring for confirmation dialogs...");
}

// Automatically start monitoring
monitorConfirmDialogs();

console.log("\n🎯 Quick Start:");
console.log("1. Run: testCartMerging()");
console.log("2. Follow the instructions to test the functionality");
console.log("3. Try creating a cart with an existing name to see the merge dialog");
