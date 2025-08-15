// PDF Centering Verification Script
// Run this in browser console while on the application

window.testPDFCentering = async function() {
  console.log("🔍 PDF CENTERING DIAGNOSTIC TEST");
  console.log("="  .repeat(50));
  
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
  
  // Create test data
  const testClient = {
    id: 'test-client-centering',
    name: 'PDF Centering Test Client',
    email: 'test@centering.com',
    billingCalculation: 'byWeight'
  };
  
  const testInvoice = {
    id: 'centering-test-001',
    invoiceNumber: 2001,
    clientId: testClient.id,
    clientName: testClient.name,
    date: new Date().toISOString().split('T')[0],
    deliveryDate: new Date().toISOString().split('T')[0],
    total: 125.50,
    totalWeight: 45.2,
    truckNumber: 'TEST-01',
    carts: [
      {
        id: 'test-cart-centering',
        name: 'Centering Test Cart',
        items: [
          {
            productId: 'test-1',
            productName: 'Test Uniform Shirt',
            quantity: 10,
            price: 3.50
          },
          {
            productId: 'test-2',
            productName: 'Test Uniform Pants',
            quantity: 8,
            price: 4.25
          },
          {
            productId: 'test-3',
            productName: 'Test Lab Coat',
            quantity: 5,
            price: 6.75
          }
        ],
        total: 125.50,
        createdAt: new Date().toISOString(),
        createdBy: 'Centering Test'
      }
    ],
    products: [],
    status: 'approved',
    verified: true
  };
  
  const signatureData = {
    signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    signedByName: 'Test Signature Person',
    driverName: 'Test Driver',
    deliveryDate: new Date().toLocaleDateString()
  };
  
  console.log("📋 Test data created");
  console.log("📄 Testing different paper sizes and settings...");
  
  // Test configurations
  const testConfigs = [
    {
      name: "Letter Portrait (Default)",
      options: {
        paperSize: 'letter',
        orientation: 'portrait',
        pagination: 'single'
      }
    },
    {
      name: "Letter Portrait (90% width)",
      options: {
        paperSize: 'letter',
        orientation: 'portrait',
        pagination: 'single'
      }
    },
    {
      name: "A4 Portrait",
      options: {
        paperSize: 'a4',
        orientation: 'portrait',
        pagination: 'single'
      }
    },
    {
      name: "Legal Portrait",
      options: {
        paperSize: 'legal',
        orientation: 'portrait',
        pagination: 'single'
      }
    }
  ];
  
  const results = [];
  
  for (const config of testConfigs) {
    console.log(`\n🧪 Testing: ${config.name}`);
    console.log("-".repeat(30));
    
    try {
      const startTime = Date.now();
      
      // Generate PDF with current settings
      const pdfData = await generateSignedDeliveryPDF(
        testInvoice,
        testClient,
        signatureData,
        config.options
      );
      
      const endTime = Date.now();
      const generationTime = endTime - startTime;
      
      // Calculate PDF size
      const pdfSizeBytes = (pdfData.length * 3) / 4;
      const pdfSizeMB = pdfSizeBytes / (1024 * 1024);
      
      console.log(`✅ PDF generated successfully`);
      console.log(`⏱️  Generation time: ${generationTime}ms`);
      console.log(`📄 PDF size: ${pdfSizeMB.toFixed(2)}MB`);
      
      // Store results
      results.push({
        config: config.name,
        success: true,
        generationTime: generationTime,
        sizeMB: pdfSizeMB,
        hasValidData: pdfData && pdfData.startsWith('data:')
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
  
  // Summary
  console.log("\n📊 TEST RESULTS SUMMARY");
  console.log("="  .repeat(50));
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.config}:`);
      console.log(`   Time: ${result.generationTime}ms`);
      console.log(`   Size: ${result.sizeMB.toFixed(2)}MB`);
      console.log(`   Valid: ${result.hasValidData ? 'YES' : 'NO'}`);
    } else {
      console.log(`❌ ${result.config}: ${result.error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Success Rate: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
  
  // Check for centering issues in console logs
  console.log("\n🔍 CENTERING ANALYSIS:");
  console.log("Check the console logs above for:");
  console.log("• 'PDF Centered to Match Preview' messages");
  console.log("• 'Margin equality: EQUAL ✅' vs 'NOT EQUAL ❌'");
  console.log("• Canvas dimensions and aspect ratios");
  console.log("• Left/right margin calculations");
  
  // Recommendations
  console.log("\n🔧 NEXT STEPS:");
  if (successCount === results.length) {
    console.log("✅ All PDF generation tests passed!");
    console.log("✅ Check the console logs above for margin equality messages");
    console.log("✅ Download a PDF to visually verify centering");
    console.log("💡 If margins still appear unequal visually:");
    console.log("   1. Check browser developer tools for any CSS interference");
    console.log("   2. Verify the preview component uses identical styling");
    console.log("   3. Test with different content lengths");
  } else {
    console.log("❌ Some tests failed - check errors above");
    console.log("🔧 Try fixing import issues or missing dependencies");
  }
  
  return results;
};

// Also test the preview component centering
window.testPreviewCentering = function() {
  console.log("\n🖥️  PREVIEW COMPONENT CENTERING CHECK");
  console.log("="  .repeat(50));
  
  // Look for preview elements
  const previewElements = document.querySelectorAll('.signed-delivery-ticket, [class*="preview"], [class*="ticket"]');
  
  if (previewElements.length === 0) {
    console.log("❌ No preview elements found");
    console.log("💡 Navigate to Settings → Printing → PDF Preview to test");
    return;
  }
  
  previewElements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    console.log(`📋 Element ${index + 1}:`);
    console.log(`   Class: ${element.className}`);
    console.log(`   Width: ${rect.width}px`);
    console.log(`   Height: ${rect.height}px`);
    console.log(`   Left: ${rect.left}px`);
    console.log(`   Display: ${computedStyle.display}`);
    console.log(`   Margin: ${computedStyle.margin}`);
    console.log(`   Text Align: ${computedStyle.textAlign}`);
    console.log(`   Max Width: ${computedStyle.maxWidth}`);
    
    // Check parent container centering
    const parent = element.parentElement;
    if (parent) {
      const parentStyle = window.getComputedStyle(parent);
      console.log(`   Parent Display: ${parentStyle.display}`);
      console.log(`   Parent Justify Content: ${parentStyle.justifyContent}`);
      console.log(`   Parent Align Items: ${parentStyle.alignItems}`);
    }
  });
};

console.log("🧪 PDF CENTERING TEST FUNCTIONS LOADED");
console.log("=" .repeat(50));
console.log("📋 Available functions:");
console.log("• testPDFCentering() - Test PDF generation with centering analysis");
console.log("• testPreviewCentering() - Check preview component centering");
console.log("");
console.log("🚀 Run these functions in the browser console to test PDF centering!");
console.log("📍 For best results, navigate to Settings → Printing first");
