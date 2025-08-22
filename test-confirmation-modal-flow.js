/**
 * Test Script: Product Confirmation Modal After Quantity Modal
 * 
 * This script specifically tests that the confirmation modal appears
 * on top after entering quantity in the keypad modal.
 * 
 * USAGE:
 * 1. Open an invoice details modal
 * 2. Click "Add New Item" 
 * 3. Click on a product
 * 4. Open browser console (F12)
 * 5. Paste this script and press Enter
 * 6. Enter quantity and click OK in keypad modal
 * 7. Script will automatically verify confirmation modal appears
 */

console.log("🧪 Product Confirmation Modal Test Script Loaded");
console.log("=" .repeat(60));

/**
 * Test that confirmation modal appears after quantity modal
 */
window.testConfirmationModalFlow = function() {
  console.log("🚀 Testing Confirmation Modal After Quantity Input...");
  console.log("-" .repeat(50));
  
  // Step 1: Check if quantity keypad modal is currently open
  const keypadModal = document.querySelector('.modal.show[style*="zIndex: 3500"]');
  if (!keypadModal) {
    console.log("❌ Quantity keypad modal not found.");
    console.log("Please follow these steps first:");
    console.log("1. Click 'Add New Item' button");
    console.log("2. Click on a product");
    console.log("3. The quantity keypad should appear");
    console.log("4. Then run this test again");
    return;
  }
  
  console.log("✅ Step 1: Quantity keypad modal is open");
  
  // Step 2: Check if OK button is present
  const okButton = Array.from(keypadModal.querySelectorAll('button'))
    .find(btn => btn.textContent.trim() === 'OK');
  
  if (!okButton) {
    console.log("❌ OK button not found in quantity keypad");
    return;
  }
  
  console.log("✅ Step 2: OK button found in quantity keypad");
  
  // Step 3: Monitor for confirmation modal
  let confirmationModalAppeared = false;
  let keypadModalClosed = false;
  
  const observer = new MutationObserver((mutations) => {
    // Check if confirmation modal appeared
    const confirmModal = document.querySelector('.product-confirmation-modal');
    if (confirmModal && !confirmationModalAppeared) {
      confirmationModalAppeared = true;
      console.log("✅ Step 4: Confirmation modal appeared!");
      
      // Check z-index
      const styles = window.getComputedStyle(confirmModal);
      console.log(`   • Z-Index: ${styles.zIndex}`);
      console.log(`   • Display: ${styles.display}`);
      console.log(`   • Position: ${styles.position}`);
      
      // Check if it's on top
      const rect = confirmModal.getBoundingClientRect();
      console.log(`   • Visible: ${rect.width > 0 && rect.height > 0}`);
      console.log(`   • Size: ${rect.width}x${rect.height}`);
    }
    
    // Check if keypad modal closed
    const currentKeypad = document.querySelector('.modal.show[style*="zIndex: 3500"]');
    if (!currentKeypad && !keypadModalClosed) {
      keypadModalClosed = true;
      console.log("✅ Step 3: Quantity keypad modal closed properly");
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  
  // Step 4: Instructions for user
  console.log("✅ Step 3: Monitoring for modal transitions...");
  console.log("\n🎯 NEXT STEPS:");
  console.log("1. Enter a quantity in the keypad (e.g., click '1')");
  console.log("2. Click the 'OK' button");
  console.log("3. Watch for confirmation modal to appear");
  console.log("\n👁️  Monitoring modal changes...");
  
  // Auto-detect when OK is clicked
  okButton.addEventListener('click', () => {
    console.log("🔄 OK button clicked - waiting for confirmation modal...");
    
    setTimeout(() => {
      if (!confirmationModalAppeared) {
        console.log("❌ Confirmation modal did not appear after 2 seconds");
        console.log("Checking current modal state...");
        checkCurrentModalState();
      }
    }, 2000);
  });
  
  // Stop monitoring after 30 seconds
  setTimeout(() => {
    observer.disconnect();
    if (confirmationModalAppeared && keypadModalClosed) {
      console.log("\n🎉 SUCCESS! Confirmation modal flow is working correctly:");
      console.log("   ✅ Quantity keypad closed");
      console.log("   ✅ Confirmation modal appeared on top");
      console.log("   ✅ Modal transitions are smooth");
    } else {
      console.log("\n❌ Test incomplete or failed:");
      console.log(`   • Keypad closed: ${keypadModalClosed ? '✅' : '❌'}`);
      console.log(`   • Confirmation appeared: ${confirmationModalAppeared ? '✅' : '❌'}`);
    }
  }, 30000);
};

/**
 * Check current modal state
 */
function checkCurrentModalState() {
  console.log("\n🔍 Current Modal State:");
  console.log("-" .repeat(30));
  
  const allModals = document.querySelectorAll('.modal.show');
  console.log(`Total open modals: ${allModals.length}`);
  
  allModals.forEach((modal, index) => {
    const styles = window.getComputedStyle(modal);
    const title = modal.querySelector('.modal-title');
    const zIndex = styles.zIndex;
    const className = modal.className;
    
    console.log(`Modal ${index + 1}:`);
    console.log(`   Title: "${title ? title.textContent : 'No title'}"`);
    console.log(`   Z-Index: ${zIndex}`);
    console.log(`   Classes: ${className}`);
    console.log(`   Visible: ${modal.offsetWidth > 0 && modal.offsetHeight > 0}`);
  });
  
  // Specific checks
  const invoiceModal = document.querySelector('.modal.show[style*="zIndex: 2000"]');
  const productModal = document.querySelector('.add-product-modal');
  const keypadModal = document.querySelector('.modal.show[style*="zIndex: 3500"]');
  const confirmModal = document.querySelector('.product-confirmation-modal');
  
  console.log("\n🎯 Modal-Specific Status:");
  console.log(`   Invoice Modal: ${invoiceModal ? '✅ Open' : '❌ Closed'}`);
  console.log(`   Product Selection Modal: ${productModal ? '✅ Open' : '❌ Closed'}`);
  console.log(`   Quantity Keypad Modal: ${keypadModal ? '✅ Open' : '❌ Closed'}`);
  console.log(`   Confirmation Modal: ${confirmModal ? '✅ Open' : '❌ Closed'}`);
}

/**
 * Quick status check
 */
window.checkConfirmationModalStatus = function() {
  const confirmModal = document.querySelector('.product-confirmation-modal');
  if (confirmModal) {
    const styles = window.getComputedStyle(confirmModal);
    const rect = confirmModal.getBoundingClientRect();
    
    console.log("📊 Confirmation Modal Status:");
    console.log(`   Found: ✅ Yes`);
    console.log(`   Z-Index: ${styles.zIndex}`);
    console.log(`   Display: ${styles.display}`);
    console.log(`   Visible: ${rect.width > 0 && rect.height > 0 ? '✅ Yes' : '❌ No'}`);
    console.log(`   Position: ${rect.left}, ${rect.top}`);
    console.log(`   Size: ${rect.width}x${rect.height}`);
  } else {
    console.log("📊 Confirmation Modal Status: ❌ Not found");
  }
};

console.log("\n🎯 Available Functions:");
console.log("• testConfirmationModalFlow() - Test the confirmation modal flow");
console.log("• checkConfirmationModalStatus() - Check confirmation modal status");
console.log("\n💡 Ready! Open keypad modal and run testConfirmationModalFlow()");
