// Debug Cart Print Settings Modal Size
// Copy and paste this into the browser console to debug the modal size issue

console.log("🔍 Debugging Cart Print Settings Modal Size");
console.log("============================================");

function debugCartPrintSettingsModal() {
  // Step 1: Check if we're on the right page
  const settingsElements = document.querySelectorAll('*');
  const printingSection = Array.from(settingsElements).find(el => 
    el.textContent?.includes('🖨️') && el.textContent?.includes('Printing')
  );
  
  if (!printingSection) {
    console.log("❌ Not on printing settings page. Navigate to Settings → 🖨️ Printing first");
    return;
  }
  
  console.log("✅ On printing settings page");
  
  // Step 2: Look for Cart Print Settings buttons
  const cartPrintButtons = Array.from(document.querySelectorAll('button'))
    .filter(btn => btn.textContent?.includes('Cart Print Settings'));
  
  console.log(`📋 Found ${cartPrintButtons.length} "Cart Print Settings" buttons`);
  
  if (cartPrintButtons.length === 0) {
    console.log("❌ No Cart Print Settings buttons found");
    console.log("💡 Make sure you have clients in your system");
    return;
  }
  
  // Step 3: Click the first Cart Print Settings button
  console.log("🖱️ Clicking first Cart Print Settings button...");
  cartPrintButtons[0].click();
  
  // Step 4: Wait and check the modal
  setTimeout(() => {
    const modal = document.querySelector('.modal-dialog[style*="70vw"]');
    const modalContent = document.querySelector('.modal-content[style*="height: 100%"]');
    const modalTitle = document.querySelector('.modal-title');
    
    if (modal && modalTitle?.textContent?.includes('Print Configuration')) {
      console.log("✅ PrintConfigModal opened successfully");
      
      // Get actual dimensions
      const modalRect = modal.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const actualWidthPercent = (modalRect.width / viewportWidth * 100).toFixed(1);
      const actualHeightPercent = (modalRect.height / viewportHeight * 100).toFixed(1);
      
      console.log("📐 Modal Dimensions Analysis:");
      console.log(`   Modal Width: ${modalRect.width}px (${actualWidthPercent}% of viewport)`);
      console.log(`   Modal Height: ${modalRect.height}px (${actualHeightPercent}% of viewport)`);
      console.log(`   Viewport: ${viewportWidth}x${viewportHeight}`);
      
      // Check styling
      const modalStyles = window.getComputedStyle(modal);
      console.log("🎨 Modal Styling:");
      console.log(`   width: ${modalStyles.width}`);
      console.log(`   maxWidth: ${modalStyles.maxWidth}`);
      console.log(`   minWidth: ${modalStyles.minWidth}`);
      console.log(`   height: ${modalStyles.height}`);
      
      // Check if modal is using 70% width correctly
      if (actualWidthPercent >= 65 && actualWidthPercent <= 75) {
        console.log("✅ Modal is correctly sized at ~70% width");
        
        // Check for potential display issues
        const browserZoom = Math.round(window.devicePixelRatio * 100);
        console.log(`🔍 Browser zoom level: ${browserZoom}%`);
        
        if (browserZoom !== 100) {
          console.log("⚠️  Browser zoom is not 100% - this may make the modal appear smaller");
        }
        
        const windowIsMaximized = window.outerWidth === screen.width;
        console.log(`🖥️  Window maximized: ${windowIsMaximized}`);
        
        if (!windowIsMaximized) {
          console.log("⚠️  Browser window is not maximized - this reduces the actual modal size");
        }
        
        console.log("💡 Possible reasons modal appears small:");
        console.log("   1. Browser zoom level not at 100%");
        console.log("   2. Browser window not maximized");
        console.log("   3. High-resolution display making 70% appear smaller");
        console.log("   4. Display scaling settings in OS");
        
      } else {
        console.log("❌ Modal is not correctly sized at 70% width");
        console.log("🐛 This indicates a code issue");
      }
      
    } else {
      console.log("❌ PrintConfigModal did not open correctly");
      
      // Check if any modal opened
      const anyModal = document.querySelector('.modal.show');
      if (anyModal) {
        const anyModalTitle = anyModal.querySelector('.modal-title');
        console.log(`❓ Different modal opened: "${anyModalTitle?.textContent}"`);
      } else {
        console.log("❌ No modal opened at all");
      }
    }
  }, 1000);
}

// Step 5: Additional viewport analysis
function analyzeViewport() {
  console.log("\n🖥️  Viewport Analysis:");
  console.log(`   Screen Resolution: ${screen.width}x${screen.height}`);
  console.log(`   Available Screen: ${screen.availWidth}x${screen.availHeight}`);
  console.log(`   Window Size: ${window.innerWidth}x${window.innerHeight}`);
  console.log(`   Window Outer: ${window.outerWidth}x${window.outerHeight}`);
  console.log(`   Device Pixel Ratio: ${window.devicePixelRatio}`);
  console.log(`   Zoom Level: ${Math.round(window.devicePixelRatio * 100)}%`);
  
  const modal70vw = Math.round(window.innerWidth * 0.7);
  console.log(`   70% of viewport width: ${modal70vw}px`);
  
  if (modal70vw < 800) {
    console.log("⚠️  70% width is less than 800px minimum - minWidth will override");
  }
}

// Run the debug
analyzeViewport();
debugCartPrintSettingsModal();

// Export functions for manual use
window.debugCartPrintSettingsModal = debugCartPrintSettingsModal;
window.analyzeViewport = analyzeViewport;

console.log("\n🔧 Functions available:");
console.log("   debugCartPrintSettingsModal() - Re-run the modal test");
console.log("   analyzeViewport() - Check viewport details");
