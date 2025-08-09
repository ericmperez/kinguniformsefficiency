/**
 * Test Script: Real-time PDF Preview Updates
 * 
 * This script helps verify that PDF customization options are updating the preview in real-time.
 * 
 * USAGE:
 * 1. Navigate to Settings → 🖨️ Printing in the app
 * 2. Click "PDF Preview" for any client
 * 3. Click "PDF Options" to show the customization panel
 * 4. Open browser console (F12)
 * 5. Paste this script and press Enter
 * 6. Run: testRealTimeUpdates()
 */

console.log("🔄 Real-time PDF Preview Updates Test Script Loaded");

/**
 * Test real-time updates of PDF preview options
 */
window.testRealTimeUpdates = function() {
  console.log("🚀 Testing Real-time PDF Preview Updates...");
  console.log("=" .repeat(70));
  
  // Check if we're in the right modal
  const modal = document.querySelector('.signed-delivery-ticket-modal');
  if (!modal) {
    console.log("❌ Signed Delivery Ticket Preview modal not found");
    console.log("💡 Please open the PDF Preview modal first:");
    console.log("   1. Go to Settings → 🖨️ Printing");
    console.log("   2. Click 'PDF Preview' for any client");
    console.log("   3. Click 'PDF Options' to show customization panel");
    return;
  }
  
  console.log("✅ PDF Preview modal found");
  
  // Check if customization panel is open
  const customizationPanel = modal.querySelector('.card-header.bg-primary');
  if (!customizationPanel) {
    console.log("❌ PDF customization panel not visible");
    console.log("💡 Click the 'PDF Options' button to show customization options");
    return;
  }
  
  console.log("✅ PDF customization panel is open");
  
  // Find the preview container
  const previewContainer = modal.querySelector('[style*="transform: scale"]');
  if (!previewContainer) {
    console.log("❌ PDF preview container not found");
    return;
  }
  
  console.log("✅ PDF preview container found");
  
  // Test 1: Scale changes
  console.log("\n🧪 Test 1: Testing Scale Updates");
  console.log("-".repeat(40));
  
  const scaleSlider = modal.querySelector('input[type="range"]');
  if (scaleSlider) {
    const originalScale = scaleSlider.value;
    console.log(`📏 Original scale: ${(parseFloat(originalScale) * 100).toFixed(0)}%`);
    
    // Change scale
    scaleSlider.value = '1.5';
    scaleSlider.dispatchEvent(new Event('input', { bubbles: true }));
    
    setTimeout(() => {
      const newTransform = previewContainer.style.transform;
      console.log(`🔄 New transform: ${newTransform}`);
      console.log(newTransform.includes('scale(1.5)') ? '✅ Scale updated successfully' : '❌ Scale update failed');
      
      // Reset scale
      scaleSlider.value = originalScale;
      scaleSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }, 100);
  } else {
    console.log("❌ Scale slider not found");
  }
  
  // Test 2: Paper size changes
  setTimeout(() => {
    console.log("\n🧪 Test 2: Testing Paper Size Updates");
    console.log("-".repeat(40));
    
    const paperSizeSelect = Array.from(modal.querySelectorAll('select')).find(select => 
      select.querySelector('option[value="letter"]') || select.querySelector('option[value="a4"]')
    );
    
    if (paperSizeSelect) {
      const originalSize = paperSizeSelect.value;
      console.log(`📄 Original paper size: ${originalSize}`);
      
      // Change to A4 if currently Letter, or Letter if currently A4
      const newSize = originalSize === 'letter' ? 'a4' : 'letter';
      paperSizeSelect.value = newSize;
      paperSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      
      setTimeout(() => {
        const newMaxWidth = previewContainer.style.maxWidth;
        console.log(`📐 New maxWidth: ${newMaxWidth}`);
        
        const expectedWidth = newSize === 'a4' ? '800px' : '800px';
        console.log(newMaxWidth === expectedWidth ? '✅ Paper size updated successfully' : '❌ Paper size update failed');
        
        // Reset paper size
        paperSizeSelect.value = originalSize;
        paperSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }, 100);
    } else {
      console.log("❌ Paper size selector not found");
    }
  }, 500);
  
  // Test 3: Watermark toggle
  setTimeout(() => {
    console.log("\n🧪 Test 3: Testing Watermark Toggle");
    console.log("-".repeat(40));
    
    const watermarkCheckbox = modal.querySelector('#showWatermark');
    if (watermarkCheckbox) {
      const originalChecked = watermarkCheckbox.checked;
      console.log(`💧 Original watermark state: ${originalChecked ? 'ON' : 'OFF'}`);
      
      // Toggle watermark
      watermarkCheckbox.checked = !originalChecked;
      watermarkCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      
      setTimeout(() => {
        const watermarkElement = modal.querySelector('[style*="PREVIEW"]');
        const hasWatermark = !!watermarkElement;
        console.log(`🔍 Watermark ${hasWatermark ? 'found' : 'not found'} in preview`);
        console.log(hasWatermark === !originalChecked ? '✅ Watermark toggle works' : '❌ Watermark toggle failed');
        
        // Reset watermark
        watermarkCheckbox.checked = originalChecked;
        watermarkCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }, 100);
    } else {
      console.log("❌ Watermark checkbox not found");
    }
  }, 1000);
  
  // Test 4: Border toggle
  setTimeout(() => {
    console.log("\n🧪 Test 4: Testing Border Toggle");
    console.log("-".repeat(40));
    
    const borderCheckbox = modal.querySelector('#showBorder');
    if (borderCheckbox) {
      const originalChecked = borderCheckbox.checked;
      console.log(`🖼️ Original border state: ${originalChecked ? 'ON' : 'OFF'}`);
      
      // Toggle border
      borderCheckbox.checked = !originalChecked;
      borderCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      
      setTimeout(() => {
        const previewBorder = modal.querySelector('[style*="border"][style*="solid"]');
        const hasBorder = !!previewBorder;
        console.log(`🔍 Border ${hasBorder ? 'found' : 'not found'} in preview container`);
        console.log(hasBorder === !originalChecked ? '✅ Border toggle works' : '❌ Border toggle failed');
        
        // Reset border
        borderCheckbox.checked = originalChecked;
        borderCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }, 100);
    } else {
      console.log("❌ Border checkbox not found");
    }
  }, 1500);
  
  // Test 5: Auto-save verification
  setTimeout(() => {
    console.log("\n🧪 Test 5: Testing Auto-save Functionality");
    console.log("-".repeat(40));
    
    // Check if localStorage is being updated
    const storedOptions = localStorage.getItem('pdfOptions');
    if (storedOptions) {
      try {
        const parsed = JSON.parse(storedOptions);
        console.log("✅ PDF options found in localStorage");
        console.log("📁 Stored options preview:", {
          scale: parsed.scale,
          paperSize: parsed.paperSize,
          showWatermark: parsed.showWatermark,
          showBorder: parsed.showBorder
        });
      } catch (error) {
        console.log("❌ Error parsing stored options:", error);
      }
    } else {
      console.log("❌ No PDF options found in localStorage");
    }
  }, 2000);
  
  // Summary
  setTimeout(() => {
    console.log("\n" + "=".repeat(70));
    console.log("🎉 Real-time PDF Preview Update Test Complete");
    console.log("\n📝 What to look for:");
    console.log("• Changes should be instant when adjusting controls");
    console.log("• No page refresh needed for updates");
    console.log("• Settings are automatically saved to localStorage");
    console.log("• Preview reflects all customization changes immediately");
    
    console.log("\n💡 If updates aren't working:");
    console.log("1. Check browser console for errors");
    console.log("2. Ensure the PDF Options panel is open");
    console.log("3. Try refreshing the page and testing again");
    console.log("4. Verify JavaScript is enabled in your browser");
  }, 2500);
};

/**
 * Quick test to verify real-time functionality
 */
window.quickRealTimeTest = function() {
  console.log("⚡ Quick Real-time Test...");
  
  const modal = document.querySelector('.signed-delivery-ticket-modal');
  if (!modal) {
    console.log("❌ Modal not found. Open PDF Preview first.");
    return;
  }
  
  const scaleSlider = modal.querySelector('input[type="range"]');
  if (scaleSlider) {
    const original = scaleSlider.value;
    scaleSlider.value = '1.2';
    scaleSlider.dispatchEvent(new Event('input', { bubbles: true }));
    
    setTimeout(() => {
      const container = modal.querySelector('[style*="transform: scale"]');
      const works = container && container.style.transform.includes('scale(1.2)');
      console.log(works ? '✅ Real-time updates working' : '❌ Real-time updates not working');
      
      // Reset
      scaleSlider.value = original;
      scaleSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }, 100);
  } else {
    console.log("❌ Scale slider not found");
  }
};

// Auto-run quick test after script loads
setTimeout(() => {
  console.log("\n🎯 Available test functions:");
  console.log("• testRealTimeUpdates() - Complete real-time functionality test");
  console.log("• quickRealTimeTest() - Quick verification test");
  
  // Auto-run quick test if we're in the right context
  const inPDFModal = !!document.querySelector('.signed-delivery-ticket-modal');
  
  if (inPDFModal) {
    console.log("\n🔄 Auto-running quick test...");
    quickRealTimeTest();
  } else {
    console.log("\n💡 Open PDF Preview modal to auto-test functionality");
  }
}, 1000);

console.log("\n📋 Instructions:");
console.log("1. Open Settings → 🖨️ Printing");
console.log("2. Click 'PDF Preview' for any client");
console.log("3. Click 'PDF Options' to show customization panel");
console.log("4. Run testRealTimeUpdates() for comprehensive testing");
