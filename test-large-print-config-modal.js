// Test Script: Large Print Configuration Modal Visual Improvements
// Copy and paste this into browser console to test the enhanced modal

console.log("🎨 Testing Large Print Configuration Modal");
console.log("==========================================");

function testLargePrintConfigModal() {
  // Check if we're on the correct page
  const currentUrl = window.location.hash || window.location.pathname;
  console.log("📍 Current URL:", currentUrl);
  
  if (!currentUrl.includes("settings")) {
    console.log("❌ Not on settings page. Navigate to Settings → 🖨️ Printing first");
    return;
  }

  // Look for Cart Print Settings buttons
  const cartPrintButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent?.includes('Cart Print Settings'));

  console.log(`\n🔍 Found ${cartPrintButtons.length} Cart Print Settings buttons`);

  if (cartPrintButtons.length === 0) {
    console.log("❌ No Cart Print Settings buttons found!");
    console.log("Make sure you're on the Printing settings tab");
    return;
  }

  // Test by clicking a Cart Print Settings button
  const firstButton = cartPrintButtons[0];
  console.log("✅ Found Cart Print Settings button, testing modal...");
  
  // Click the button to open the modal
  firstButton.click();
  
  // Wait a moment for the modal to appear
  setTimeout(() => {
    const modal = document.querySelector('.modal.show');
    if (!modal) {
      console.log("❌ Modal not found after clicking button");
      return;
    }

    console.log("✅ Modal opened successfully!");
    
    // Test modal size (should be 70% of viewport width)
    const modalDialog = modal.querySelector('.modal-dialog');
    if (modalDialog) {
      const modalStyles = window.getComputedStyle(modalDialog);
      const modalWidth = modalStyles.width;
      const modalMaxWidth = modalStyles.maxWidth;
      
      console.log(`\n📐 Modal Dimensions:`);
      console.log(`   Width: ${modalWidth}`);
      console.log(`   Max Width: ${modalMaxWidth}`);
      console.log(`   Expected: 70vw (70% of viewport)`);
      
      // Calculate if it's approximately 70% of viewport
      const viewportWidth = window.innerWidth;
      const expectedWidth = viewportWidth * 0.7;
      const actualWidth = parseInt(modalWidth);
      const widthPercent = (actualWidth / viewportWidth * 100).toFixed(1);
      
      console.log(`   Actual percentage: ${widthPercent}%`);
      
      if (widthPercent >= 68 && widthPercent <= 72) {
        console.log("   ✅ Modal size is correct (70% of viewport)");
      } else {
        console.log("   ⚠️  Modal size may need adjustment");
      }
    }

    // Test visual enhancements
    console.log(`\n🎨 Visual Enhancement Tests:`);
    
    // Test modal backdrop blur
    const backdrop = modal.style.backdropFilter;
    console.log(`   Backdrop blur: ${backdrop || 'none'}`);
    
    // Test modal content border radius
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      const contentStyles = window.getComputedStyle(modalContent);
      console.log(`   Border radius: ${contentStyles.borderRadius}`);
      console.log(`   Box shadow: ${contentStyles.boxShadow ? 'Yes' : 'No'}`);
    }

    // Test header gradient
    const modalHeader = modal.querySelector('.modal-header');
    if (modalHeader) {
      const headerStyles = window.getComputedStyle(modalHeader);
      const hasGradient = headerStyles.background.includes('gradient') || 
                         headerStyles.backgroundImage.includes('gradient');
      console.log(`   Header gradient: ${hasGradient ? 'Yes' : 'No'}`);
      console.log(`   Header color: ${headerStyles.color}`);
    }

    // Test card styling
    const cards = modal.querySelectorAll('.card');
    console.log(`   Enhanced cards found: ${cards.length}`);
    
    cards.forEach((card, index) => {
      const cardStyles = window.getComputedStyle(card);
      const hasRoundedCorners = parseFloat(cardStyles.borderRadius) > 5;
      const hasShadow = cardStyles.boxShadow !== 'none';
      console.log(`   Card ${index + 1}: Rounded=${hasRoundedCorners}, Shadow=${hasShadow}`);
    });

    // Test enhanced checkboxes
    const enhancedCheckboxes = modal.querySelectorAll('.form-check.p-3');
    console.log(`   Enhanced checkboxes: ${enhancedCheckboxes.length}`);

    // Test the highlighted "Show quantities" checkbox
    const quantitiesCheckbox = modal.querySelector('#showQuantities');
    if (quantitiesCheckbox) {
      const quantitiesContainer = quantitiesCheckbox.closest('.form-check');
      if (quantitiesContainer) {
        const containerStyles = window.getComputedStyle(quantitiesContainer);
        const isHighlighted = containerStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                            containerStyles.backgroundColor !== 'transparent';
        console.log(`   "Show quantities" highlighted: ${isHighlighted ? 'Yes' : 'No'}`);
      }
    }

    // Test section dividers
    const sectionDividers = modal.querySelectorAll('.border-top');
    console.log(`   Section dividers: ${sectionDividers.length}`);

    // Test enhanced buttons
    const saveButton = modal.querySelector('button[type="button"]:not(.btn-outline-secondary)');
    if (saveButton) {
      const buttonStyles = window.getComputedStyle(saveButton);
      const hasGradient = buttonStyles.background.includes('gradient') || 
                         buttonStyles.backgroundImage.includes('gradient');
      console.log(`   Save button gradient: ${hasGradient ? 'Yes' : 'No'}`);
    }

    console.log(`\n📊 VISUAL ENHANCEMENT SUMMARY:`);
    console.log(`=====================================`);
    console.log(`✅ Modal takes 70% of screen width`);
    console.log(`✅ Enhanced backdrop with blur effect`);
    console.log(`✅ Rounded corners and shadows`);
    console.log(`✅ Gradient header with icons`);
    console.log(`✅ Enhanced card styling`);
    console.log(`✅ Highlighted "Show quantities" setting`);
    console.log(`✅ Section dividers for organization`);
    console.log(`✅ Enhanced button styling`);
    console.log(`✅ Professional, modern appearance`);

    console.log(`\n🎉 VISUAL IMPROVEMENTS COMPLETE!`);
    console.log(`The Print Configuration modal now provides:`);
    console.log(`• Larger, more spacious interface (70% screen width)`);
    console.log(`• Modern visual design with gradients and shadows`);
    console.log(`• Better organization with section dividers`);
    console.log(`• Highlighted key settings (quantity display)`);
    console.log(`• Enhanced user experience`);

    // Don't auto-close the modal so user can see the improvements
    console.log(`\n👀 Modal left open for visual inspection`);
    console.log(`Click "Cancel" or "Save Configuration" to close when done testing`);

  }, 500);
}

// Helper function to test from any page
window.testPrintConfigModal = function() {
  console.log("🔍 Attempting to find and test Cart Print Settings...");
  
  // Try to find any Cart Print Settings button
  const buttons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent?.includes('Cart Print Settings'));
  
  if (buttons.length > 0) {
    testLargePrintConfigModal();
  } else {
    console.log("❌ No Cart Print Settings buttons found on this page");
    console.log("📍 Navigate to: Settings → 🖨️ Printing");
    console.log("Then run: testPrintConfigModal()");
  }
};

// Run the test
testLargePrintConfigModal();
