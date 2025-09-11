/**
 * Debug Script: Test Completion Modal Buttons
 * 
 * This script specifically tests why the mangle and doblado buttons
 * might not be working in the completion modal.
 * 
 * HOW TO USE:
 * 1. Open the app in browser
 * 2. Navigate to Active Invoices page
 * 3. Click completion button on any invoice
 * 4. Open browser console (F12)
 * 5. Paste this script and run it
 */

console.log("🐛 DEBUG: Completion Modal Buttons Test");
console.log("=" .repeat(50));

/**
 * Test the completion modal buttons functionality
 */
function debugCompletionButtons() {
  console.log("🔍 Testing completion modal buttons...");
  
  // Check if modal is open
  const modal = document.querySelector('.modal.show');
  const modalTitle = modal?.querySelector('.modal-title');
  
  if (!modal) {
    console.log("❌ No modal is currently open");
    console.log("💡 Please open a completion modal first by clicking the clipboard icon");
    return;
  }
  
  if (!modalTitle?.textContent?.includes('Select Completion Parts')) {
    console.log("❌ Wrong modal type detected");
    console.log(`   Current modal title: "${modalTitle?.textContent}"`);
    console.log("💡 Please open a completion modal specifically");
    return;
  }
  
  console.log("✅ Completion modal detected!");
  
  // Test checkboxes and their functionality
  const manglesCheckbox = modal.querySelector('#manglesCheckbox');
  const dobladoCheckbox = modal.querySelector('#dobladoCheckbox');
  
  console.log("\n🔲 Testing Checkboxes:");
  console.log(`   • Mangles checkbox: ${manglesCheckbox ? '✅ Found' : '❌ Missing'}`);
  console.log(`   • Doblado checkbox: ${dobladoCheckbox ? '✅ Found' : '❌ Missing'}`);
  
  if (manglesCheckbox) {
    console.log(`   • Mangles checked: ${manglesCheckbox.checked}`);
    console.log(`   • Mangles disabled: ${manglesCheckbox.disabled}`);
  }
  
  if (dobladoCheckbox) {
    console.log(`   • Doblado checked: ${dobladoCheckbox.checked}`);
    console.log(`   • Doblado disabled: ${dobladoCheckbox.disabled}`);
  }
  
  // Test the Apply Changes button
  const applyButton = modal.querySelector('.btn-primary');
  const cancelButton = modal.querySelector('.btn-secondary');
  
  console.log("\n🔘 Testing Action Buttons:");
  console.log(`   • Apply Changes button: ${applyButton ? '✅ Found' : '❌ Missing'}`);
  console.log(`   • Cancel button: ${cancelButton ? '✅ Found' : '❌ Missing'}`);
  
  if (applyButton) {
    console.log(`   • Apply button text: "${applyButton.textContent?.trim()}"`);
    console.log(`   • Apply button disabled: ${applyButton.disabled}`);
    console.log(`   • Apply button has onClick: ${applyButton.onclick ? 'Yes' : 'No'}`);
    
    // Check for React event listeners (they won't show up in onclick)
    const reactProps = Object.keys(applyButton).find(key => key.startsWith('__reactProps'));
    if (reactProps) {
      console.log(`   • Apply button has React events: Yes`);
    }
  }
  
  // Test checkbox interaction
  console.log("\n🧪 Testing Checkbox Interactions:");
  
  if (manglesCheckbox) {
    console.log("   Testing mangles checkbox click...");
    const initialState = manglesCheckbox.checked;
    
    // Simulate checkbox click
    manglesCheckbox.click();
    
    setTimeout(() => {
      const newState = manglesCheckbox.checked;
      console.log(`   • Mangles checkbox state changed: ${initialState !== newState ? '✅ Yes' : '❌ No'}`);
      console.log(`   • Before: ${initialState}, After: ${newState}`);
      
      // Check if visual preview updated
      const previewBox = modal.querySelector('#manglesCheckbox').closest('.card-body').querySelector('[style*="backgroundColor"]');
      if (previewBox) {
        const bgColor = previewBox.style.backgroundColor;
        console.log(`   • Visual preview updated: ${bgColor.includes('fef3c7') && newState ? '✅ Yes' : bgColor.includes('f8f9fa') && !newState ? '✅ Yes' : '❌ No'}`);
      }
    }, 100);
  }
  
  // Test Apply Changes button functionality
  console.log("\n🎯 Testing Apply Changes Button:");
  
  if (applyButton) {
    console.log("   Attempting to click Apply Changes button...");
    
    // Store original console methods to capture any activity logs
    const originalLog = console.log;
    const originalError = console.error;
    let activityLogged = false;
    let errorLogged = false;
    
    console.log = function(...args) {
      const message = args.join(' ');
      if (message.includes('marked laundry ticket') || message.includes('completion')) {
        activityLogged = true;
        originalLog('📝 Activity detected:', ...args);
      }
      return originalLog(...args);
    };
    
    console.error = function(...args) {
      errorLogged = true;
      originalError('❌ Error detected:', ...args);
      return originalError(...args);
    };
    
    // Click the Apply Changes button
    applyButton.click();
    
    setTimeout(() => {
      // Restore console methods
      console.log = originalLog;
      console.error = originalError;
      
      // Check if modal closed (successful operation)
      const modalStillOpen = document.querySelector('.modal.show');
      const isCompletionModal = modalStillOpen?.querySelector('.modal-title')?.textContent?.includes('Select Completion Parts');
      
      console.log(`   • Modal closed after click: ${!isCompletionModal ? '✅ Yes' : '❌ No'}`);
      console.log(`   • Activity logged: ${activityLogged ? '✅ Yes' : '❌ No'}`);
      console.log(`   • Errors occurred: ${errorLogged ? '❌ Yes' : '✅ No'}`);
      
      if (!isCompletionModal) {
        console.log("   🎉 Apply Changes button appears to be working!");
        
        // Check if invoice cards updated visually
        setTimeout(() => {
          console.log("\n🎨 Checking Invoice Visual Updates:");
          const invoiceCards = document.querySelectorAll('.invoice-card, [style*="background"]');
          let updatedCardsFound = 0;
          
          invoiceCards.forEach(card => {
            const style = card.style.background || card.style.backgroundImage || '';
            if (style.includes('fef3c7') || style.includes('linear-gradient')) {
              updatedCardsFound++;
            }
          });
          
          console.log(`   • Cards with completion styling: ${updatedCardsFound}`);
          if (updatedCardsFound > 0) {
            console.log("   ✅ Visual updates detected on invoice cards!");
          }
        }, 1000);
        
      } else {
        console.log("   ❌ Apply Changes button not working - modal remained open");
        console.log("   💡 This indicates the handleApplyCompletion function may have issues");
      }
      
    }, 1500);
  }
  
  return {
    modal,
    manglesCheckbox,
    dobladoCheckbox,
    applyButton,
    cancelButton
  };
}

/**
 * Test specific client configuration issues
 */
function testClientConfiguration() {
  console.log("\n⚙️ Testing Client Configuration:");
  
  const modal = document.querySelector('.modal.show');
  if (!modal) return;
  
  // Check if sections are conditionally rendered
  const manglesSection = modal.querySelector('#manglesCheckbox')?.closest('.col-md-6');
  const dobladoSection = modal.querySelector('#dobladoCheckbox')?.closest('.col-md-6');
  
  const manglesVisible = manglesSection && getComputedStyle(manglesSection).display !== 'none';
  const dobladoVisible = dobladoSection && getComputedStyle(dobladoSection).display !== 'none';
  
  console.log(`   • Mangles section visible: ${manglesVisible ? '✅ Yes' : '❌ Hidden'}`);
  console.log(`   • Doblado section visible: ${dobladoVisible ? '✅ Yes' : '❌ Hidden'}`);
  
  if (!manglesVisible && !dobladoVisible) {
    console.log("   ❌ ISSUE FOUND: Both sections are hidden!");
    console.log("   💡 This means the client's completedOptionPosition setting may be incorrect");
    console.log("   🔧 Check the client settings for this invoice");
  } else if (!manglesVisible) {
    console.log("   ℹ️ Client configured for BOTTOM ONLY completion");
  } else if (!dobladoVisible) {
    console.log("   ℹ️ Client configured for TOP ONLY completion");
  } else {
    console.log("   ✅ Client configured for BOTH sections (normal mode)");
  }
}

/**
 * Quick button click test
 */
function quickButtonTest() {
  const modal = document.querySelector('.modal.show');
  if (!modal) return;
  
  const applyButton = modal.querySelector('.btn-primary');
  const manglesCheckbox = modal.querySelector('#manglesCheckbox');
  
  if (manglesCheckbox && applyButton) {
    console.log("\n🚀 Quick Test: Select Mangle and Apply");
    
    // Select mangle checkbox
    if (!manglesCheckbox.checked) {
      manglesCheckbox.click();
    }
    
    setTimeout(() => {
      console.log("   Clicking Apply Changes...");
      applyButton.click();
    }, 500);
  }
}

// Auto-detect and test if modal is already open
const existingModal = document.querySelector('.modal.show');
const modalTitle = existingModal?.querySelector('.modal-title');

if (existingModal && modalTitle?.textContent?.includes('Select Completion Parts')) {
  console.log("🎯 Completion modal detected! Running debug test...");
  debugCompletionButtons();
  testClientConfiguration();
  
  // Make functions available for manual testing
  window.debugCompletionButtons = debugCompletionButtons;
  window.testClientConfiguration = testClientConfiguration;
  window.quickButtonTest = quickButtonTest;
  
} else {
  console.log("⏳ No completion modal found. Please:");
  console.log("   1. Navigate to Active Invoices page");
  console.log("   2. Click on a completion button (clipboard icon)");
  console.log("   3. Run: debugCompletionButtons()");
  
  // Make functions available globally
  window.debugCompletionButtons = debugCompletionButtons;
  window.testClientConfiguration = testClientConfiguration;
  window.quickButtonTest = quickButtonTest;
}

console.log("\n🔧 Available Functions:");
console.log("• debugCompletionButtons() - Full debug test");
console.log("• testClientConfiguration() - Check client settings");
console.log("• quickButtonTest() - Quick functionality test");
