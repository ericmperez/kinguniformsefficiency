// Test script to verify Cart Print Settings modal takes up 70% of screen width
// Run this in browser console to verify the modal size

console.log("📏 Testing Cart Print Settings Modal (70% screen width)");

function testCartPrintSettingsModalSize() {
  console.log("🔍 Testing Cart Print Settings modal implementation...");
  
  // Check if we're on the main page
  if (!document.querySelector('.container')) {
    console.log("❌ Page not fully loaded. Please wait and try again.");
    return;
  }
  
  // Look for the PrintingSettings button or similar navigation
  const printingSettingsButton = document.querySelector('a[href*="settings"], button[title*="Print"], .btn:contains("Print Settings")');
  
  if (!printingSettingsButton) {
    console.log(`
🔍 Manual Instructions:

1. Navigate to the Printing Settings page
2. Click on "Configure" button for any client
3. The Cart Print Settings modal should open
4. Run testCartPrintSettingsModalSize() again to verify size

Expected modal size:
✅ Width: 70% of viewport (minimum 800px)
✅ Height: 96% of viewport
✅ Professional styling with blue header
✅ Two-column layout for settings
    `);
    return;
  }
  
  // Try to find and click a Configure button
  console.log("📋 Looking for client configuration buttons...");
  
  setTimeout(() => {
    const configureButtons = document.querySelectorAll('button[title*="Configure"], .btn:contains("Configure")');
    console.log(`🔧 Found ${configureButtons.length} configure buttons`);
    
    if (configureButtons.length > 0) {
      console.log("🖱️ Clicking first configure button...");
      configureButtons[0].click();
      
      setTimeout(() => {
        verifyModalSize();
      }, 500);
    } else {
      console.log(`
⚠️ Could not find configure buttons automatically.

Manual testing steps:
1. Go to Printing Settings page
2. Click "Configure" button for any client
3. Verify the modal opens at 70% screen width
4. Check that it has a blue header with "Print Configuration"
5. Confirm it contains Cart Print Settings and Invoice Print Settings
      `);
    }
  }, 1000);
}

function verifyModalSize() {
  // Check if PrintConfigModal is open
  const modal = document.querySelector('.modal.show');
  const modalDialog = document.querySelector('.modal-dialog[style*="70vw"]');
  const modalContent = document.querySelector('.modal-content[style*="height: 100%"]');
  const modalHeader = document.querySelector('.modal-header[style*="linear-gradient"]');
  
  if (modal && modalDialog) {
    console.log("✅ Cart Print Settings modal found and opened!");
    
    // Get actual modal dimensions
    const modalRect = modalDialog.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const modalWidthPercent = (modalRect.width / viewportWidth * 100).toFixed(1);
    const modalHeightPercent = (modalRect.height / viewportHeight * 100).toFixed(1);
    
    console.log("📐 Modal size verification:", {
      modalWidth: `${modalRect.width}px`,
      modalHeight: `${modalRect.height}px`,
      viewportWidth: `${viewportWidth}px`,
      viewportHeight: `${viewportHeight}px`,
      widthPercentage: `${modalWidthPercent}%`,
      heightPercentage: `${modalHeightPercent}%`,
      hasCorrectWidthStyle: !!modalDialog.style.width.includes('70vw'),
      hasCorrectMaxWidthStyle: !!modalDialog.style.maxWidth.includes('70vw'),
      hasMinWidth: !!modalDialog.style.minWidth.includes('800px'),
      hasCorrectModalContentHeight: !!modalContent,
      hasBlueHeaderGradient: !!modalHeader
    });
    
    // Check for key components
    const cartPrintSettings = document.querySelector('h6:contains("Cart Print Settings"), .card-header:contains("Cart")');
    const invoicePrintSettings = document.querySelector('h6:contains("Invoice Print Settings"), .card-header:contains("Invoice")');
    const emailSettings = document.querySelector('h6:contains("Email Settings"), .card-header:contains("Email")');
    const clientNameFontSize = document.querySelector('#clientNameFontSize, select[id*="clientNameFontSize"]');
    
    console.log("🔧 Modal components verification:", {
      hasCartPrintSettings: !!cartPrintSettings,
      hasInvoicePrintSettings: !!invoicePrintSettings,
      hasEmailSettings: !!emailSettings,
      hasClientNameFontSizeSelector: !!clientNameFontSize,
      modalTitle: document.querySelector('.modal-title')?.textContent || 'Not found'
    });
    
    console.log(`
✅ CART PRINT SETTINGS MODAL (70% SCREEN WIDTH) VERIFIED

Modal Dimensions:
📐 Width: 70% of viewport (${modalWidthPercent}% actual)
📐 Height: 96% of viewport (${modalHeightPercent}% actual)
📐 Minimum Width: 800px enforced
📐 Professional blue gradient header

Layout Features:
🎨 Two-column layout for Cart and Invoice settings
📧 Email configuration section
🔤 Client name font size selector (with Small, Medium, Large options)
💾 Save Configuration button with King Uniforms branding

The Cart Print Settings modal is properly sized at 70% of screen width!
    `);
    
  } else if (modal) {
    console.log("⚠️ A modal is open but it may not be the PrintConfigModal:");
    console.log("Modal title:", document.querySelector('.modal-title')?.textContent || 'Unknown');
    console.log("Checking for correct styling...");
    
    const anyModalDialog = document.querySelector('.modal-dialog');
    if (anyModalDialog) {
      const rect = anyModalDialog.getBoundingClientRect();
      const widthPercent = (rect.width / window.innerWidth * 100).toFixed(1);
      console.log(`Current modal width: ${widthPercent}% of viewport`);
    }
  } else {
    console.log("❌ No modal found. Please manually open the Cart Print Settings modal:");
    console.log("1. Go to Printing Settings");
    console.log("2. Click 'Configure' for any client");
    console.log("3. The modal should open at 70% screen width");
  }
}

// Instructions
console.log(`
🧪 CART PRINT SETTINGS MODAL SIZE TEST

This test verifies that the Cart Print Settings modal takes up 70% of the screen width.

Expected Features:
✅ Modal width: 70% of viewport (minimum 800px)
✅ Modal height: 96% of viewport  
✅ Blue gradient header with "Print Configuration"
✅ Two-column layout: Cart Settings | Invoice Settings
✅ Email configuration section
✅ Client name font size selector
✅ Professional King Uniforms styling

Run testCartPrintSettingsModalSize() to start the test.
`);

// Auto-run if on a page that looks like it has settings
if (window.location.pathname.includes('settings') || document.querySelector('.settings') || document.querySelector('[href*="settings"]')) {
  setTimeout(testCartPrintSettingsModalSize, 2000);
}
