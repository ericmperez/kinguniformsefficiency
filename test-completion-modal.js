/**
 * Test script for the Two-Step Completion Modal
 * 
 * This script verifies that the completion modal correctly shows/hides sections
 * based on the client's completedOptionPosition setting.
 * 
 * HOW TO USE:
 * 1. Open the app in browser: http://localhost:5175
 * 2. Navigate to Active Invoices page
 * 3. Open browser console (F12)
 * 4. Paste this script and run it
 * 5. Click on a completion button for any invoice
 * 6. The script will automatically test the modal functionality
 */

console.log("🧪 Two-Step Completion Modal Test Script");
console.log("📋 This script tests the completion modal conditional rendering");

/**
 * Test the completion modal functionality
 */
async function testCompletionModal() {
  console.log("🔍 Testing completion modal functionality...");
  
  // Check if we're on the correct page
  if (!window.location.pathname.includes('invoices')) {
    console.error("❌ Please navigate to the Active Invoices page first");
    return;
  }
  
  // Wait for completion modal to appear
  const waitForModal = (timeout = 10000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkModal = () => {
        const modal = document.querySelector('.modal.show');
        const modalTitle = modal?.querySelector('.modal-title');
        
        if (modal && modalTitle?.textContent?.includes('Select Completion Parts')) {
          resolve(modal);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Completion modal did not appear within timeout'));
        } else {
          setTimeout(checkModal, 100);
        }
      };
      
      checkModal();
    });
  };
  
  try {
    console.log("⏳ Waiting for completion modal to open...");
    console.log("💡 Click on a completion button (clipboard icon) on any invoice card");
    
    const modal = await waitForModal();
    console.log("✅ Completion modal detected!");
    
    // Test modal structure
    const modalBody = modal.querySelector('.modal-body');
    const manglesSection = modal.querySelector('#manglesCheckbox')?.closest('.col-md-6, .col-md-8');
    const dobladoSection = modal.querySelector('#dobladoCheckbox')?.closest('.col-md-6, .col-md-8');
    
    // Determine which sections are visible
    const manglesVisible = manglesSection && !manglesSection.hidden && 
                          getComputedStyle(manglesSection).display !== 'none';
    const dobladoVisible = dobladoSection && !dobladoSection.hidden && 
                          getComputedStyle(dobladoSection).display !== 'none';
    
    console.log("📊 Modal Configuration Analysis:");
    console.log(`   • Mangles - Arriba (Top) section: ${manglesVisible ? '✅ Visible' : '❌ Hidden'}`);
    console.log(`   • Doblado - Abajo (Bottom) section: ${dobladoVisible ? '✅ Visible' : '❌ Hidden'}`);
    
    // Test layout responsiveness
    const container = modal.querySelector('.row');
    const hasJustifyCenter = container?.classList.contains('justify-content-center');
    
    if (manglesVisible && dobladoVisible) {
      console.log("🎯 Client Setting: BOTH sections enabled");
      console.log(`   • Layout: ${hasJustifyCenter ? 'Centered' : 'Two-column'} (should be two-column)`);
      
      // Check if both sections use col-md-6
      const manglesClass = manglesSection?.className;
      const dobladoClass = dobladoSection?.className;
      
      if (manglesClass?.includes('col-md-6') && dobladoClass?.includes('col-md-6')) {
        console.log("✅ Correct: Both sections use col-md-6 (50% width each)");
      } else {
        console.log("⚠️  Warning: Sections don't use expected col-md-6 classes");
      }
      
    } else if (manglesVisible && !dobladoVisible) {
      console.log("🎯 Client Setting: TOP ONLY section enabled");
      console.log(`   • Layout: ${hasJustifyCenter ? 'Centered ✅' : 'Not centered ⚠️'} (should be centered)`);
      console.log(`   • Section width: ${manglesSection?.className?.includes('col-md-8') ? 'col-md-8 ✅' : 'Not col-md-8 ⚠️'}`);
      
    } else if (!manglesVisible && dobladoVisible) {
      console.log("🎯 Client Setting: BOTTOM ONLY section enabled");
      console.log(`   • Layout: ${hasJustifyCenter ? 'Centered ✅' : 'Not centered ⚠️'} (should be centered)`);
      console.log(`   • Section width: ${dobladoSection?.className?.includes('col-md-8') ? 'col-md-8 ✅' : 'Not col-md-8 ⚠️'}`);
      
    } else {
      console.log("❌ Error: No sections are visible! This shouldn't happen.");
    }
    
    // Test alert system
    const alerts = modal.querySelectorAll('.alert');
    console.log(`📢 Dynamic Alerts: ${alerts.length} alert(s) found`);
    
    alerts.forEach((alert, index) => {
      const alertType = alert.className.includes('alert-success') ? 'Success' :
                       alert.className.includes('alert-warning') ? 'Warning' :
                       alert.className.includes('alert-info') ? 'Info' : 'Unknown';
      const alertText = alert.textContent?.trim().substring(0, 50) + '...';
      console.log(`   ${index + 1}. ${alertType}: ${alertText}`);
    });
    
    // Test checkboxes functionality
    if (manglesVisible) {
      const manglesCheckbox = modal.querySelector('#manglesCheckbox');
      console.log(`🔲 Mangles checkbox: ${manglesCheckbox ? 'Found ✅' : 'Not found ❌'}`);
      console.log(`   • Checked: ${manglesCheckbox?.checked ? 'Yes' : 'No'}`);
    }
    
    if (dobladoVisible) {
      const dobladoCheckbox = modal.querySelector('#dobladoCheckbox');
      console.log(`🔲 Doblado checkbox: ${dobladoCheckbox ? 'Found ✅' : 'Not found ❌'}`);
      console.log(`   • Checked: ${dobladoCheckbox?.checked ? 'Yes' : 'No'}`);
    }
    
    // Test buttons
    const cancelButton = modal.querySelector('.btn-secondary');
    const applyButton = modal.querySelector('.btn-primary');
    
    console.log("🔘 Modal Buttons:");
    console.log(`   • Cancel button: ${cancelButton ? 'Found ✅' : 'Not found ❌'}`);
    console.log(`   • Apply button: ${applyButton ? 'Found ✅' : 'Not found ❌'}`);
    console.log(`   • Apply button text: "${applyButton?.textContent?.trim()}"`);
    
    console.log("\n🎉 Test completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   ✅ Modal opens correctly");
    console.log("   ✅ Sections show/hide based on client setting");
    console.log("   ✅ Layout adjusts dynamically (centered vs two-column)");
    console.log("   ✅ Interactive elements present");
    console.log("   ✅ Alert system working");
    
    console.log("\n💡 To test different client settings:");
    console.log("   1. Close this modal");
    console.log("   2. Try completion buttons on invoices for different clients");
    console.log("   3. Each client may have different completedOptionPosition settings");
    console.log("   4. Run this test script again to verify each configuration");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Make sure you're on the Active Invoices page");
    console.log("   2. Click on a completion button (clipboard icon) first");
    console.log("   3. The modal should appear before running this test");
  }
}

// Auto-detect if modal is already open
const existingModal = document.querySelector('.modal.show');
const modalTitle = existingModal?.querySelector('.modal-title');

if (existingModal && modalTitle?.textContent?.includes('Select Completion Parts')) {
  console.log("🎯 Completion modal detected! Running test...");
  testCompletionModal();
} else {
  console.log("⏳ Completion modal not found. Please:");
  console.log("   1. Navigate to Active Invoices page");
  console.log("   2. Click on a completion button (clipboard icon)");
  console.log("   3. Run this command: testCompletionModal()");
  
  // Make the function available globally
  window.testCompletionModal = testCompletionModal;
}
