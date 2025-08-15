// Enhanced PDF Centering Test - New Approach
// Run this in browser console to test the improved centering

window.testNewCenteringApproach = async function() {
  console.log("🎯 NEW PDF CENTERING APPROACH TEST");
  console.log("="  .repeat(60));
  
  // Import the PDF service
  let generateSignedDeliveryPDF;
  try {
    const pdfService = await import('/src/services/signedDeliveryPdfService.ts');
    generateSignedDeliveryPDF = pdfService.generateSignedDeliveryPDF;
    console.log("✅ PDF service imported successfully");
  } catch (error) {
    console.error("❌ Failed to import PDF service:", error);
    return;
  }
  
  // Test data with varied content to test centering
  const testData = {
    client: {
      id: 'centering-test',
      name: 'PDF Centering Test Client',
      email: 'test@centering.com',
      billingCalculation: 'byWeight'
    },
    invoice: {
      id: 'center-test-001',
      invoiceNumber: 10001,
      clientId: 'centering-test',
      clientName: 'PDF Centering Test Client',
      date: new Date().toISOString().split('T')[0],
      deliveryDate: new Date().toISOString().split('T')[0],
      total: 245.75,
      totalWeight: 75.5,
      truckNumber: 'CENTER-01',
      carts: [
        {
          id: 'center-cart-1',
          name: 'Centering Test Cart 1',
          items: [
            { productId: 'c1', productName: 'Short Name Item 1', quantity: 5, price: 3.50 },
            { productId: 'c2', productName: 'Medium Length Item Name 2', quantity: 8, price: 4.25 },
            { productId: 'c3', productName: 'Very Long Item Name That Should Test Text Wrapping 3', quantity: 12, price: 6.75 },
            { productId: 'c4', productName: 'Another Test Item 4', quantity: 3, price: 8.50 },
            { productId: 'c5', productName: 'Final Test Item With Long Description 5', quantity: 7, price: 5.25 }
          ],
          total: 245.75,
          createdAt: new Date().toISOString(),
          createdBy: 'Centering Test'
        }
      ],
      products: [],
      status: 'approved',
      verified: true
    },
    signatureData: {
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      signedByName: 'Centering Test Person',
      driverName: 'Centering Test Driver',
      deliveryDate: new Date().toLocaleDateString()
    }
  };
  
  // Test different approaches
  const testConfigs = [
    {
      name: "NEW Content-Sized with Enhanced Centering",
      options: {
        paperSize: 'content',
        margins: 'content',
        pagination: 'single'
      }
    },
    {
      name: "Letter Size with New Centering Algorithm",
      options: {
        paperSize: 'letter',
        orientation: 'portrait',
        pagination: 'single'
      }
    },
    {
      name: "A4 Size with New Centering Algorithm",
      options: {
        paperSize: 'a4',
        orientation: 'portrait',
        pagination: 'single'
      }
    }
  ];
  
  const results = [];
  
  for (const config of testConfigs) {
    console.log(`\n🧪 Testing: ${config.name}`);
    console.log("-".repeat(50));
    
    try {
      const startTime = Date.now();
      
      const pdfData = await generateSignedDeliveryPDF(
        testData.invoice,
        testData.client,
        testData.signatureData,
        config.options
      );
      
      const endTime = Date.now();
      const generationTime = endTime - startTime;
      
      // Calculate PDF size
      const pdfSizeBytes = (pdfData.length * 3) / 4;
      const pdfSizeMB = pdfSizeBytes / (1024 * 1024);
      
      console.log(`✅ Generated successfully`);
      console.log(`⏱️  Time: ${generationTime}ms`);
      console.log(`📄 Size: ${pdfSizeMB.toFixed(2)}MB`);
      
      results.push({
        config: config.name,
        success: true,
        generationTime: generationTime,
        sizeMB: pdfSizeMB,
        isContentSized: config.name.includes('Content-Sized')
      });
      
      // Brief delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      results.push({
        config: config.name,
        success: false,
        error: error.message
      });
    }
  }
  
  // Analysis
  console.log("\n📊 NEW CENTERING APPROACH RESULTS");
  console.log("="  .repeat(60));
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.config}:`);
      console.log(`   Generation time: ${result.generationTime}ms`);
      console.log(`   File size: ${result.sizeMB.toFixed(2)}MB`);
      console.log(`   Content-sized: ${result.isContentSized ? 'YES' : 'NO'}`);
    } else {
      console.log(`❌ ${result.config}: ${result.error}`);
    }
  });
  
  console.log("\n🔍 CENTERING ANALYSIS CHECKLIST:");
  console.log("="  .repeat(60));
  console.log("Check the console logs above for these indicators:");
  console.log("");
  console.log("✅ GOOD CENTERING INDICATORS:");
  console.log("• 'NEW CENTERING APPROACH applied'");
  console.log("• 'margin: 0 auto' for element centering");
  console.log("• 'Wrapper element analysis' with centered positioning");
  console.log("• 'Perfect centering with no empty space' (content-sized)");
  console.log("• 'Horizontal centering: PERFECT ✅' or 'EXCELLENT ✅'");
  console.log("");
  console.log("❌ ISSUES TO WATCH FOR:");
  console.log("• Large margin differences (>1 point)");
  console.log("• 'NEEDS WORK ❌' centering messages");
  console.log("• Wrapper positioning far from center");
  console.log("• Content area much smaller than PDF dimensions");
  console.log("");
  console.log("🎯 KEY IMPROVEMENTS IN NEW APPROACH:");
  console.log("• Simplified container (block instead of flexbox)");
  console.log("• text-align: center for container centering");
  console.log("• inline-block wrapper with margin: 0 auto");
  console.log("• Better content dimension measurement");
  console.log("• Enhanced scaling and centering calculations");
  console.log("");
  console.log("📝 NEXT STEPS:");
  console.log("1. Download a PDF and visually verify centering");
  console.log("2. Compare with the attached PDF that was off-center");
  console.log("3. Test with different content lengths");
  console.log("4. Verify mobile display looks good");
  
  return results;
};

// Quick visual test
window.quickCenteringCheck = function() {
  console.log("👁️  QUICK VISUAL CENTERING CHECK");
  console.log("="  .repeat(40));
  
  // Look for any delivery ticket elements currently on the page
  const elements = document.querySelectorAll('.signed-delivery-ticket, [class*="ticket"], [class*="delivery"]');
  
  if (elements.length === 0) {
    console.log("❌ No delivery ticket elements found on current page");
    console.log("💡 Navigate to Settings → Printing → PDF Preview to see elements");
    return;
  }
  
  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const parentRect = element.parentElement?.getBoundingClientRect();
    
    if (parentRect) {
      const leftSpace = rect.left - parentRect.left;
      const rightSpace = parentRect.right - rect.right;
      const isWellCentered = Math.abs(leftSpace - rightSpace) < 10; // Within 10px
      
      console.log(`📋 Element ${index + 1}:`);
      console.log(`   Width: ${rect.width.toFixed(1)}px`);
      console.log(`   Left space: ${leftSpace.toFixed(1)}px`);
      console.log(`   Right space: ${rightSpace.toFixed(1)}px`);
      console.log(`   Difference: ${Math.abs(leftSpace - rightSpace).toFixed(1)}px`);
      console.log(`   Centering: ${isWellCentered ? '✅ GOOD' : '❌ NEEDS WORK'}`);
    }
  });
};

console.log("🎯 NEW PDF CENTERING TEST FUNCTIONS LOADED");
console.log("="  .repeat(50));
console.log("📋 Available functions:");
console.log("• testNewCenteringApproach() - Test the new centering algorithm");
console.log("• quickCenteringCheck() - Quick visual check of current elements");
console.log("");
console.log("🚀 NEW APPROACH FEATURES:");
console.log("✅ Simplified container setup (block + text-align)");
console.log("✅ Inline-block wrapper with auto margins");
console.log("✅ Better content dimension measurement");
console.log("✅ Enhanced scaling and positioning");
console.log("✅ More precise centering calculations");
console.log("");
console.log("🧪 Run testNewCenteringApproach() to test the improvements!");
