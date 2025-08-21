// Enhanced Cart Styling Test Script
// Run this in the browser console after opening an invoice details modal

console.log("🎨 Enhanced Cart Styling Test Script Loaded");

function testEnhancedCartStyling() {
  console.log("🔍 Testing Enhanced Cart Styling...\n");
  
  // Check if we're in the right context
  const modal = document.querySelector('.modal.show');
  if (!modal) {
    console.log("❌ No modal is currently open. Please open an invoice details modal first.");
    return;
  }
  
  const modalTitle = modal.querySelector('.modal-title');
  const isInvoiceModal = modalTitle && modalTitle.textContent.includes('Laundry Ticket');
  
  if (!isInvoiceModal) {
    console.log("❌ Please open an Invoice Details modal to test cart styling.");
    return;
  }
  
  console.log("✅ Invoice Details modal is open\n");
  
  // Check for enhanced cart sections
  const enhancedCarts = document.querySelectorAll('.enhanced-cart-section');
  console.log(`📊 Found ${enhancedCarts.length} enhanced cart section(s)`);
  
  if (enhancedCarts.length === 0) {
    console.log("❌ No enhanced cart sections found. The styling may not be applied yet.");
    return;
  }
  
  // Test each enhanced cart
  enhancedCarts.forEach((cart, index) => {
    console.log(`\n🛒 Cart ${index + 1}:`);
    
    // Check cart name
    const cartName = cart.querySelector('.enhanced-cart-name');
    if (cartName) {
      console.log(`   ✅ Enhanced cart name: "${cartName.textContent?.trim()}"`);
    } else {
      console.log(`   ❌ Enhanced cart name styling not found`);
    }
    
    // Check cart status
    const cartStatus = cart.querySelector('.enhanced-cart-status');
    if (cartStatus) {
      console.log(`   ✅ Enhanced cart status found`);
    } else {
      console.log(`   ❌ Enhanced cart status styling not found`);
    }
    
    // Check cart actions
    const cartActions = cart.querySelector('.enhanced-cart-actions');
    if (cartActions) {
      console.log(`   ✅ Enhanced cart actions container found`);
    } else {
      console.log(`   ❌ Enhanced cart actions styling not found`);
    }
    
    // Check cart content
    const cartContent = cart.querySelector('.enhanced-cart-content');
    if (cartContent) {
      console.log(`   ✅ Enhanced cart content container found`);
    } else {
      console.log(`   ❌ Enhanced cart content styling not found`);
    }
    
    // Check cart products
    const cartProducts = cart.querySelectorAll('.enhanced-cart-product');
    console.log(`   📦 Enhanced product cards: ${cartProducts.length}`);
    
    // Check cart creator
    const cartCreator = cart.querySelector('.enhanced-cart-creator');
    if (cartCreator) {
      console.log(`   ✅ Enhanced cart creator info found`);
    } else {
      console.log(`   ❌ Enhanced cart creator styling not found`);
    }
    
    // Check for unnamed cart styling
    if (cart.classList.contains('cart-unnamed')) {
      console.log(`   🔴 Cart has unnamed styling (red variant)`);
    }
  });
  
  // Check CSS animations
  console.log("\n🎬 Animation Tests:");
  const hasEntranceAnimation = enhancedCarts[0] && getComputedStyle(enhancedCarts[0]).animation.includes('enhanced-cart-entrance');
  if (hasEntranceAnimation) {
    console.log("   ✅ Cart entrance animations are active");
  } else {
    console.log("   ❓ Cart entrance animations may have finished or not be active");
  }
  
  // Check hover effects
  console.log("\n🖱️ Hover Effect Test:");
  if (enhancedCarts.length > 0) {
    const firstCart = enhancedCarts[0];
    console.log("   💡 Try hovering over a cart to see the lift effect!");
    
    // Add temporary event listeners to test
    const originalTransition = firstCart.style.transition;
    firstCart.addEventListener('mouseenter', function() {
      console.log("   🔄 Hover effect activated");
    }, { once: true });
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("🎉 ENHANCED CART STYLING TEST COMPLETE");
  console.log("\nKey Features Implemented:");
  console.log("✨ Professional gradients and shadows");
  console.log("🎨 King Uniforms color scheme");
  console.log("🔄 Smooth hover animations");
  console.log("📱 Mobile responsive design");
  console.log("🎭 Special styling for unnamed carts");
  console.log("💫 Entrance animations with stagger effect");
  console.log("🧱 Enhanced visual hierarchy");
}

// Auto-run if in an invoice modal context
setTimeout(() => {
  const modal = document.querySelector('.modal.show');
  const modalTitle = modal?.querySelector('.modal-title');
  const isInvoiceModal = modalTitle && modalTitle.textContent.includes('Laundry Ticket');
  
  if (isInvoiceModal) {
    console.log("🔍 Invoice modal detected - running enhanced cart styling test...");
    testEnhancedCartStyling();
  } else {
    console.log("📋 Instructions:");
    console.log("1. Navigate to Active Invoices");
    console.log("2. Click on an invoice card to open details modal");
    console.log("3. Run testEnhancedCartStyling() to test the styling");
  }
}, 1000);

// Export function for manual use
window.testEnhancedCartStyling = testEnhancedCartStyling;

console.log("🎯 Use testEnhancedCartStyling() to test the enhanced cart styling");
