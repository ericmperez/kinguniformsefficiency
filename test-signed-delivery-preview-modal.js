// Test script for Signed Delivery Ticket Preview Modal Size
// Run this in browser console to verify the modal sizing

console.log("🔍 Testing Signed Delivery Ticket Preview Modal Size");

function testSignedDeliveryPreviewModal() {
  console.log("📋 Looking for Signed Delivery Ticket Preview modal...");
  
  // Check if modal is open
  const modal = document.querySelector('.modal.show');
  if (!modal) {
    console.log("❌ No modal is currently open.");
    console.log("\nTo test the modal:");
    console.log("1. Go to Settings → 🖨️ Printing");
    console.log("2. Click 'PDF Preview' button for any client");
    console.log("3. Run this test again");
    return;
  }

  // Check if it's the signed delivery ticket preview modal
  const modalTitle = modal.querySelector('.modal-title');
  const titleText = modalTitle ? modalTitle.textContent : '';
  
  if (!titleText.includes('Signed Delivery Ticket Preview')) {
    console.log("❌ This is not the Signed Delivery Ticket Preview modal");
    console.log(`Found modal: "${titleText}"`);
    return;
  }

  console.log("✅ Signed Delivery Ticket Preview modal detected");
  console.log(`📝 Modal title: "${titleText}"`);

  // Get modal dialog
  const modalDialog = modal.querySelector('.modal-dialog');
  if (!modalDialog) {
    console.log("❌ Modal dialog not found");
    return;
  }

  // Get actual dimensions
  const modalRect = modalDialog.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const modalWidthPercent = (modalRect.width / viewportWidth * 100).toFixed(1);
  const modalHeightPercent = (modalRect.height / viewportHeight * 100).toFixed(1);
  
  console.log("\n📐 Modal Size Analysis:");
  console.log("─".repeat(50));
  console.log(`Viewport: ${viewportWidth}px × ${viewportHeight}px`);
  console.log(`Modal: ${modalRect.width.toFixed(0)}px × ${modalRect.height.toFixed(0)}px`);
  console.log(`Width Percentage: ${modalWidthPercent}% (Target: 70%)`);
  console.log(`Height Percentage: ${modalHeightPercent}% (Target: 70%)`);

  // Get computed styles
  const computedStyle = window.getComputedStyle(modalDialog);
  console.log("\n🎨 Style Properties:");
  console.log("─".repeat(50));
  console.log(`Width: ${computedStyle.width}`);
  console.log(`Height: ${computedStyle.height}`);
  console.log(`Max Width: ${computedStyle.maxWidth}`);
  console.log(`Min Width: ${computedStyle.minWidth}`);
  console.log(`Margin: ${computedStyle.margin}`);
  console.log(`Position: ${computedStyle.position}`);

  // Check if size is correct
  const targetWidth = 70;
  const targetHeight = 70;
  const tolerance = 2;
  
  const isCorrectWidth = Math.abs(parseFloat(modalWidthPercent) - targetWidth) <= tolerance;
  const isCorrectHeight = Math.abs(parseFloat(modalHeightPercent) - targetHeight) <= tolerance;
  
  console.log("\n✅ Size Verification:");
  console.log("─".repeat(50));
  
  if (isCorrectWidth) {
    console.log(`✅ PASS: Modal width is ${modalWidthPercent}% (within ${tolerance}% of target 70%)`);
  } else {
    console.log(`❌ FAIL: Modal width is ${modalWidthPercent}% (should be ~70%)`);
  }
  
  if (isCorrectHeight) {
    console.log(`✅ PASS: Modal height is ${modalHeightPercent}% (within ${tolerance}% of target 70%)`);
  } else {
    console.log(`❌ FAIL: Modal height is ${modalHeightPercent}% (should be ~70%)`);
  }

  // Check PDF preview scaling
  const pdfPreview = modal.querySelector('[style*="transform: scale"]');
  if (pdfPreview) {
    const scaleMatch = pdfPreview.style.transform.match(/scale\(([\d.]+)\)/);
    const scaleValue = scaleMatch ? scaleMatch[1] : 'not found';
    console.log(`🔍 PDF Preview Scale: ${scaleValue}x`);
  }

  // Check for potential issues
  console.log("\n🔧 Diagnostic Information:");
  console.log("─".repeat(50));
  
  const browserZoom = Math.round(window.devicePixelRatio * 100);
  console.log(`Browser zoom level: ${browserZoom}%`);
  
  const windowIsMaximized = window.outerWidth >= screen.availWidth * 0.9;
  console.log(`Window appears maximized: ${windowIsMaximized}`);
  
  if (browserZoom !== 100) {
    console.log("⚠️  Browser zoom is not 100% - this may affect apparent modal size");
  }
  
  if (!windowIsMaximized) {
    console.log("⚠️  Browser window may not be maximized - this reduces available space");
  }

  // Summary
  console.log("\n📊 SUMMARY:");
  console.log("=" .repeat(60));
  
  if (isCorrectWidth && isCorrectHeight) {
    console.log("✅ SUCCESS: Modal is correctly sized at 70% of screen");
    console.log("If it appears small, check browser zoom and window size");
  } else {
    console.log("❌ ISSUE: Modal is not correctly sized");
    console.log("This indicates a CSS or layout problem that needs fixing");
  }
}

// Auto-run if we detect the correct page
if (window.location.pathname.includes('settings') || document.querySelector('[title*="PDF Preview"]')) {
  console.log("🚀 Auto-running test...");
  setTimeout(testSignedDeliveryPreviewModal, 1000);
} else {
  console.log("📝 Run testSignedDeliveryPreviewModal() manually when modal is open");
}

// Export function for manual use
window.testSignedDeliveryPreviewModal = testSignedDeliveryPreviewModal;

console.log("\n🎯 Available functions:");
console.log("testSignedDeliveryPreviewModal() - Test the modal size");
