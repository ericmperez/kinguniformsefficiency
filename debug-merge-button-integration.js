// Debug Cart Merge Button - Quick Check
// Paste this in browser console to verify merge button integration

console.log("🔍 Debugging Cart Merge Button Integration");
console.log("=".repeat(50));

// Check if we're in the right place
const modal = document.querySelector('.invoice-details-modal');
if (!modal) {
  console.log("❌ Invoice details modal not found");
  console.log("💡 Please open an invoice details modal first");
} else {
  console.log("✅ Invoice details modal found");
  
  // Check for cart sections
  const cartSections = document.querySelectorAll('.cart-section');
  console.log(`📋 Found ${cartSections.length} cart section(s)`);
  
  if (cartSections.length === 0) {
    console.log("❌ No cart sections found");
    console.log("💡 Please open an invoice that has carts");
  } else {
    console.log("✅ Cart sections found");
    
    // Check each cart for merge button
    cartSections.forEach((cart, index) => {
      const cartTitle = cart.querySelector('h3');
      const cartName = cartTitle ? cartTitle.textContent.trim() : 'Unknown';
      
      // Look for the merge button
      const mergeButton = cart.querySelector('button[title="Merge Cart"]');
      const mergeIcon = mergeButton ? mergeButton.querySelector('i.bi-arrow-left-right') : null;
      
      console.log(`\nCart ${index + 1}: "${cartName}"`);
      console.log(`  Merge button: ${mergeButton ? '✅ FOUND' : '❌ MISSING'}`);
      if (mergeButton) {
        console.log(`  Button classes: ${mergeButton.className}`);
        console.log(`  Has correct icon: ${mergeIcon ? '✅ YES' : '❌ NO'}`);
        console.log(`  Tooltip: "${mergeButton.title}"`);
      }
      
      // Check for other action buttons for context
      const printButton = cart.querySelector('button[title="Print Cart"]');
      const deleteButton = cart.querySelector('button[title="Delete Cart"]');
      console.log(`  Print button: ${printButton ? '✅' : '❌'}`);
      console.log(`  Delete button: ${deleteButton ? '✅' : '❌'}`);
    });
    
    // Overall summary
    const totalMergeButtons = document.querySelectorAll('button[title="Merge Cart"]').length;
    console.log(`\n📊 Summary:`);
    console.log(`  Total carts: ${cartSections.length}`);
    console.log(`  Total merge buttons: ${totalMergeButtons}`);
    console.log(`  Expected merge buttons: ${cartSections.length}`);
    
    if (totalMergeButtons === cartSections.length) {
      console.log("🎉 All carts have merge buttons - Integration successful!");
    } else {
      console.log("⚠️ Some carts are missing merge buttons");
    }
    
    // Test first merge button if available
    const firstMergeButton = document.querySelector('button[title="Merge Cart"]');
    if (firstMergeButton && cartSections.length > 1) {
      console.log("\n🧪 You can test the merge functionality by clicking the merge button");
      console.log("🔀 Click the merge button next to any cart name to see the merge modal");
    } else if (cartSections.length === 1) {
      console.log("\n💡 Need at least 2 carts to test merge functionality");
    }
  }
}

console.log("\n🎯 Quick Test Steps:");
console.log("1. Make sure you have an invoice with 2+ carts open");
console.log("2. Look for the merge button (🔀) between print and delete buttons");
console.log("3. Click the merge button to open the merge modal");
console.log("4. Select source and target carts and complete the merge");
