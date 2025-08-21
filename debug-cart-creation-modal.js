/**
 * Debug script for cart creation confirmation modal
 * Run this in browser console to check the modal state
 */

console.log("🔍 Cart Creation Modal Debug Script");

function debugCartCreationModal() {
  console.log("🚀 Checking for cart creation confirmation modal...");
  
  // Look for any modals with the full-screen style
  const modals = Array.from(document.querySelectorAll('.modal.show'));
  console.log(`📋 Found ${modals.length} open modal(s)`);
  
  modals.forEach((modal, index) => {
    const title = modal.querySelector('.modal-title');
    const modalStyle = modal.getAttribute('style') || '';
    const isFullscreen = modalStyle.includes('100vw') || modalStyle.includes('100vh');
    
    console.log(`\nModal ${index + 1}:`);
    console.log(`  Title: ${title ? title.textContent : 'No title'}`);
    console.log(`  Is fullscreen: ${isFullscreen}`);
    console.log(`  Style: ${modalStyle}`);
    
    // Check for buttons
    const buttons = modal.querySelectorAll('button');
    console.log(`  Buttons found: ${buttons.length}`);
    
    buttons.forEach((button, btnIndex) => {
      const text = button.textContent.trim();
      const classes = button.className;
      const style = button.getAttribute('style') || '';
      
      console.log(`    Button ${btnIndex + 1}: "${text}"`);
      console.log(`      Classes: ${classes}`);
      console.log(`      Style: ${style}`);
      console.log(`      Visible: ${button.offsetWidth > 0 && button.offsetHeight > 0}`);
      console.log(`      Display: ${window.getComputedStyle(button).display}`);
    });
    
    // Check modal footer specifically
    const footer = modal.querySelector('.modal-footer');
    if (footer) {
      console.log(`  Modal footer found`);
      console.log(`    Footer style: ${footer.getAttribute('style') || 'No inline style'}`);
      console.log(`    Footer computed display: ${window.getComputedStyle(footer).display}`);
      console.log(`    Footer computed visibility: ${window.getComputedStyle(footer).visibility}`);
    }
  });
  
  // Check if cart creation modal is specifically open
  const cartCreateModal = modals.find(modal => {
    const title = modal.querySelector('.modal-title');
    return title && title.textContent.includes('Create New Cart');
  });
  
  if (cartCreateModal) {
    console.log("\n✅ Cart creation modal found!");
    
    // Find the Yes button specifically
    const yesButton = Array.from(cartCreateModal.querySelectorAll('button'))
      .find(btn => btn.textContent.trim() === 'Yes');
    
    if (yesButton) {
      console.log("✅ 'Yes' button found!");
      console.log(`   Text: "${yesButton.textContent}"`);
      console.log(`   Classes: ${yesButton.className}`);
      console.log(`   Visible: ${yesButton.offsetWidth > 0 && yesButton.offsetHeight > 0}`);
      
      // Test if we can click it
      try {
        const rect = yesButton.getBoundingClientRect();
        console.log(`   Position: ${rect.left}px, ${rect.top}px`);
        console.log(`   Size: ${rect.width}px × ${rect.height}px`);
      } catch (e) {
        console.log(`   Error getting position: ${e.message}`);
      }
    } else {
      console.log("❌ 'Yes' button NOT found!");
      
      // List all button texts to help debug
      const buttonTexts = Array.from(cartCreateModal.querySelectorAll('button'))
        .map(btn => `"${btn.textContent.trim()}"`);
      console.log(`   Available buttons: ${buttonTexts.join(', ')}`);
    }
  } else {
    console.log("\n❌ Cart creation modal not found");
    console.log("\n💡 To test:");
    console.log("1. Open an invoice");
    console.log("2. Click 'Create New Cart'");
    console.log("3. Enter a name in the keypad");
    console.log("4. Click 'OK'");
    console.log("5. Run this script again");
  }
}

// Auto-run the debug
debugCartCreationModal();

// Export for manual use
window.debugCartCreationModal = debugCartCreationModal;

console.log("\n🔧 Run debugCartCreationModal() to check again");
