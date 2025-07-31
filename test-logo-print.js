// Test script to verify logo printing functionality
// Run this in browser console to test logo conversion

console.log("🖨️ Testing Logo Print Functionality");

function testLogoPrint() {
  console.log("📊 Logo Print Test Results:");
  
  // Test 1: Check if logo image exists
  const logoImg = document.getElementById('cart-logo-img');
  console.log("✓ Logo element found:", !!logoImg);
  
  if (logoImg) {
    console.log("✓ Logo src:", logoImg.src);
    console.log("✓ Logo complete:", logoImg.complete);
    console.log("✓ Logo dimensions:", logoImg.naturalWidth + "x" + logoImg.naturalHeight);
    
    // Test 2: Try base64 conversion
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      
      try {
        ctx.drawImage(logoImg, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        console.log("✅ Base64 conversion successful");
        console.log("📏 Base64 length:", dataURL.length);
        console.log("🔗 Base64 preview:", dataURL.substring(0, 50) + "...");
        
        // Test 3: Apply base64 to image
        logoImg.src = dataURL;
        console.log("✅ Logo updated with base64 data");
        
      } catch (e) {
        console.error("❌ Base64 conversion failed:", e);
      }
    } else {
      console.warn("⚠️ Logo not fully loaded or has no dimensions");
    }
  }
  
  // Test 4: Check print styles
  const printStyles = Array.from(document.styleSheets).some(sheet => {
    try {
      return Array.from(sheet.cssRules).some(rule => 
        rule.cssText.includes('@media print') && rule.cssText.includes('img')
      );
    } catch (e) {
      return false;
    }
  });
  
  console.log("✓ Print styles for images:", printStyles ? "Found" : "Not found");
  
  return {
    logoExists: !!logoImg,
    logoLoaded: logoImg && logoImg.complete,
    printStyles: printStyles
  };
}

// Run test
const results = testLogoPrint();
console.log("\n🎯 Test Summary:", results);

// Export for global access
window.testLogoPrint = testLogoPrint;

console.log("\n📋 Instructions:");
console.log("1. Open a cart print modal");
console.log("2. Run testLogoPrint() to verify logo conversion");
console.log("3. Try printing and check if logo appears");
console.log("4. Logo should be small in top-left corner");
console.log("5. Client name should be large and centered in top row");
console.log("6. 'Added By' column should be removed from table");
