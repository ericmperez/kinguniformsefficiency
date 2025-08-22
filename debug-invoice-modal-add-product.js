/**
 * InvoiceDetailsModal Product Addition Debug Script
 * 
 * This script will help diagnose any issues with adding products to carts
 * in the InvoiceDetailsModal component.
 * 
 * Run this in the browser console while the invoice details modal is open
 */

console.log("🔍 InvoiceDetailsModal Product Addition Debug");
console.log("════════════════════════════════════════════════");

function debugProductAddition() {
  console.log("\n📋 Checking modal state...");
  
  // Check if invoice details modal is open
  const modal = document.querySelector('.modal.show');
  if (!modal) {
    console.log("❌ No modal is currently open");
    return;
  }
  
  const modalTitle = modal.querySelector('.modal-title');
  const isInvoiceModal = modalTitle && modalTitle.textContent.includes('Laundry Ticket');
  
  if (!isInvoiceModal) {
    console.log("❌ Wrong modal type - need invoice details modal");
    console.log("   Current title:", modalTitle?.textContent || 'No title');
    return;
  }
  
  console.log("✅ Invoice details modal is open");
  
  // Check for carts in the modal
  const cartSections = document.querySelectorAll('.cart-section');
  console.log(`\n🛒 Found ${cartSections.length} cart(s) in the modal`);
  
  if (cartSections.length === 0) {
    console.log("❌ No carts found. Create a cart first.");
    return;
  }
  
  // Check each cart for add product functionality
  cartSections.forEach((cartSection, index) => {
    const cartTitle = cartSection.querySelector('h3');
    const cartName = cartTitle ? cartTitle.textContent.trim() : `Cart ${index + 1}`;
    
    console.log(`\n📦 Cart ${index + 1}: "${cartName}"`);
    
    // Look for "Add New Item" button
    const addButton = cartSection.querySelector('button');
    const addButtons = Array.from(cartSection.querySelectorAll('button'))
      .filter(btn => btn.textContent.includes('Add New Item') || btn.textContent.includes('+ Add'));
    
    if (addButtons.length > 0) {
      console.log(`   ✅ Found ${addButtons.length} "Add New Item" button(s)`);
      
      addButtons.forEach((btn, btnIndex) => {
        const isDisabled = btn.disabled;
        const isVisible = btn.offsetWidth > 0 && btn.offsetHeight > 0;
        
        console.log(`   Button ${btnIndex + 1}:`);
        console.log(`     Text: "${btn.textContent.trim()}"`);
        console.log(`     Disabled: ${isDisabled}`);
        console.log(`     Visible: ${isVisible}`);
        console.log(`     Click handler: ${btn.onclick ? 'Present' : 'Not found'}`);
      });
    } else {
      console.log("   ❌ No 'Add New Item' buttons found");
    }
    
    // Check for existing products in cart
    const productCards = cartSection.querySelectorAll('.card, .product-card, [class*="product"]');
    console.log(`   📋 Found ${productCards.length} existing product(s) in cart`);
  });
  
  // Check for any product selection modals
  const productModals = document.querySelectorAll('.add-product-modal, [class*="add-product"]');
  console.log(`\n🎯 Found ${productModals.length} product selection modal(s)`);
  
  // Check for any keypad modals
  const keypadModals = document.querySelectorAll('[class*="keypad"], .modal.show');
  const activeKeypadModals = Array.from(keypadModals).filter(modal => {
    const title = modal.querySelector('.modal-title');
    return title && (title.textContent.includes('Quantity') || title.textContent.includes('Enter'));
  });
  
  console.log(`🔢 Found ${activeKeypadModals.length} quantity keypad modal(s)`);
  
  // Check for confirmation modals
  const confirmModals = document.querySelectorAll('.modal.show');
  const activeConfirmModals = Array.from(confirmModals).filter(modal => {
    const title = modal.querySelector('.modal-title');
    return title && title.textContent.includes('Confirm');
  });
  
  console.log(`✅ Found ${activeConfirmModals.length} confirmation modal(s)`);
  
  console.log("\n💡 Test Instructions:");
  console.log("1. Click an 'Add New Item' button on any cart");
  console.log("2. Check if product selection modal opens");
  console.log("3. Select a product and check if keypad appears");
  console.log("4. Enter a quantity and check if confirmation modal appears");
  console.log("5. Confirm addition and verify product appears in cart");
  
  return {
    modalOpen: true,
    cartsFound: cartSections.length,
    addButtonsTotal: Array.from(cartSections).reduce((total, cart) => {
      const buttons = cart.querySelectorAll('button');
      return total + Array.from(buttons).filter(btn => 
        btn.textContent.includes('Add New Item') || btn.textContent.includes('+ Add')
      ).length;
    }, 0)
  };
}

function testAddProduct() {
  console.log("\n🧪 Testing product addition flow...");
  
  const cartSections = document.querySelectorAll('.cart-section');
  if (cartSections.length === 0) {
    console.log("❌ No carts available for testing");
    return;
  }
  
  const firstCart = cartSections[0];
  const addButtons = Array.from(firstCart.querySelectorAll('button'))
    .filter(btn => btn.textContent.includes('Add New Item') || btn.textContent.includes('+ Add'));
  
  if (addButtons.length === 0) {
    console.log("❌ No add buttons found in first cart");
    return;
  }
  
  const addButton = addButtons[0];
  console.log(`🖱️ Clicking "${addButton.textContent.trim()}" button...`);
  
  // Store original state
  const originalModals = document.querySelectorAll('.modal.show').length;
  
  try {
    addButton.click();
    
    setTimeout(() => {
      const newModals = document.querySelectorAll('.modal.show').length;
      const modalOpened = newModals > originalModals;
      
      console.log(`📊 Modal count: ${originalModals} → ${newModals}`);
      
      if (modalOpened) {
        console.log("✅ Product selection modal opened successfully!");
        
        // Look for product cards
        const productCards = document.querySelectorAll('.product-card, .card[class*="product"], [class*="add-product"] .card');
        console.log(`📦 Found ${productCards.length} product cards in modal`);
        
        if (productCards.length > 0) {
          console.log("💡 Click on a product card to continue testing");
        } else {
          console.log("⚠️ No product cards found in modal");
        }
      } else {
        console.log("❌ Product selection modal did not open");
        console.log("💡 Check console for any JavaScript errors");
      }
    }, 500);
    
  } catch (error) {
    console.error("❌ Error clicking add button:", error);
  }
}

// Auto-run debugging
console.log("🚀 Running automatic diagnosis...");
const result = debugProductAddition();

if (result && result.modalOpen && result.cartsFound > 0 && result.addButtonsTotal > 0) {
  console.log("\n🎉 Initial diagnosis looks good!");
  console.log("   ✅ Modal is open");
  console.log(`   ✅ ${result.cartsFound} cart(s) found`);
  console.log(`   ✅ ${result.addButtonsTotal} add button(s) found`);
  console.log("\n🧪 Run testAddProduct() to test the add flow");
} else {
  console.log("\n⚠️ Some issues detected in initial diagnosis");
}

// Export functions for manual use
window.debugProductAddition = debugProductAddition;
window.testAddProduct = testAddProduct;

console.log("\n🔧 Available functions:");
console.log("   debugProductAddition() - Re-run full diagnosis");
console.log("   testAddProduct() - Test clicking add button");
