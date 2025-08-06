// Cart Merge Functionality Test Script
// Run this in the browser console after opening an invoice with multiple carts

function testCartMerge() {
  console.log("🧪 Testing Cart Merge Functionality");
  console.log("=" .repeat(50));
  
  // Step 1: Check if we're on the right page (invoice details modal should be open)
  const modal = document.querySelector('.invoice-details-modal .modal-content');
  if (!modal) {
    console.log("❌ Invoice details modal not found");
    console.log("💡 Please open an invoice details modal first");
    return;
  }
  
  console.log("✅ Invoice details modal detected");
  
  // Step 2: Look for cart sections
  const cartSections = document.querySelectorAll('.cart-section');
  console.log(`📋 Found ${cartSections.length} cart(s) in the invoice`);
  
  if (cartSections.length < 2) {
    console.log("❌ Need at least 2 carts to test merging");
    console.log("💡 Please open an invoice with multiple carts or create additional carts");
    return;
  }
  
  // Step 3: Look for merge buttons
  const mergeButtons = Array.from(document.querySelectorAll('button[title="Merge Cart"]'));
  console.log(`🔀 Found ${mergeButtons.length} merge button(s)`);
  
  if (mergeButtons.length === 0) {
    console.log("❌ No merge buttons found");
    console.log("💡 Check if the merge button implementation is correct");
    return;
  }
  
  // Step 4: Analyze each cart and its merge button
  cartSections.forEach((cartSection, index) => {
    const cartTitle = cartSection.querySelector('h3');
    const cartName = cartTitle ? cartTitle.textContent.trim() : 'Unknown';
    
    const mergeButton = cartSection.querySelector('button[title="Merge Cart"]');
    const mergeIcon = mergeButton ? mergeButton.querySelector('i.bi-arrow-left-right') : null;
    
    console.log(`Cart ${index + 1}: "${cartName}"`);
    console.log(`  - Has merge button: ${!!mergeButton}`);
    console.log(`  - Has correct icon: ${!!mergeIcon}`);
    
    if (mergeButton) {
      console.log(`  - Button classes: ${mergeButton.className}`);
      console.log(`  - Button tooltip: ${mergeButton.title}`);
    }
  });
  
  // Step 5: Test clicking a merge button
  console.log("\n🖱️ Testing merge button click...");
  
  if (mergeButtons.length > 0) {
    console.log("✅ Merge buttons are available");
    console.log("🎯 To test merge functionality:");
    console.log("1. Click on a merge button (🔀) next to any cart name");
    console.log("2. A merge modal should appear");
    console.log("3. Select source and target carts");
    console.log("4. Click 'Merge Carts' to complete the merge");
    console.log("\n💡 You can manually click a merge button now to test the modal");
    
    // Simulate click on first merge button for testing
    console.log("\n🤖 Simulating click on first merge button...");
    try {
      mergeButtons[0].click();
      
      // Check if modal appears
      setTimeout(() => {
        const mergeModal = document.querySelector('.modal-content .modal-title');
        if (mergeModal && mergeModal.textContent.includes('Merge Carts')) {
          console.log("✅ Merge modal opened successfully!");
          console.log("🎉 Cart merge functionality is working!");
          
          // Check modal contents
          const sourceSelect = document.querySelector('select');
          const sourceOptions = sourceSelect ? sourceSelect.querySelectorAll('option').length - 1 : 0;
          console.log(`📋 Source cart options: ${sourceOptions}`);
          
          // Close modal
          const closeButton = document.querySelector('.modal .btn-close');
          if (closeButton) {
            closeButton.click();
            console.log("🚪 Closed merge modal");
          }
        } else {
          console.log("❌ Merge modal did not appear");
          console.log("💡 Check CartMergeModal implementation");
        }
      }, 500);
      
    } catch (error) {
      console.log("❌ Error clicking merge button:", error);
    }
  }
}

// Auto-run the test
console.log("🚀 Starting Cart Merge Test...");
testCartMerge();

console.log("\n📋 Manual Test Checklist:");
console.log("☐ Open an invoice with multiple carts");
console.log("☐ Look for merge buttons (🔀) next to cart names");
console.log("☐ Click a merge button");
console.log("☐ Verify merge modal opens");
console.log("☐ Select source and target carts");
console.log("☐ Complete the merge");
console.log("☐ Verify source cart is removed and target cart gets items");
