// Debug script for cart editing issues
// Run this in browser console to check current state

console.log("🔍 Cart Editing Debug Script");

// Check if we're on the right page
if (window.location.pathname === '/') {
  console.log("✅ On main page");
  
  // Check for React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log("✅ React DevTools available");
  } else {
    console.log("⚠️ React DevTools not detected");
  }
  
  // Look for invoice elements
  const invoiceCards = document.querySelectorAll('[class*="modern-invoice-card"]');
  console.log(`📋 Found ${invoiceCards.length} invoice cards`);
  
  // Check if any modals are open
  const modals = document.querySelectorAll('.modal.show');
  console.log(`🗂️ Found ${modals.length} open modals`);
  
  if (modals.length > 0) {
    const modalTitles = Array.from(modals).map(modal => {
      const title = modal.querySelector('.modal-title');
      return title ? title.textContent : 'Unknown modal';
    });
    console.log("📋 Open modals:", modalTitles);
    
    // Check for cart elements in modals
    const cartSections = document.querySelectorAll('.cart-section');
    console.log(`🛒 Found ${cartSections.length} cart sections`);
    
    cartSections.forEach((cart, index) => {
      const cartTitle = cart.querySelector('h3');
      const editButton = cart.querySelector('[title="Edit Cart Name"]');
      console.log(`Cart ${index + 1}:`, {
        name: cartTitle ? cartTitle.textContent : 'No title',
        hasEditButton: !!editButton
      });
    });
  }
  
  console.log("🎯 To test cart editing:");
  console.log("1. Click on an invoice card to open the details modal");
  console.log("2. Click the pencil icon next to a cart name");
  console.log("3. Enter a new name and check console for logs");
  console.log("4. Close and reopen the modal to see if the name persists");
  
} else {
  console.log("❌ Please navigate to the main page first");
}
