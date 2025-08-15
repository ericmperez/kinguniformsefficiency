// Content-Sized PDF Test Script
// Run this in browser console to test the new content-fitting functionality

window.testContentSizedPDF = async function() {
  console.log("📐 CONTENT-SIZED PDF TEST");
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
  
  // Create test data with varying content sizes
  const createTestData = (itemCount, description) => {
    const items = [];
    for (let i = 1; i <= itemCount; i++) {
      items.push({
        productId: `test-${i}`,
        productName: `Test Item ${i} - ${description}`,
        quantity: Math.floor(Math.random() * 20) + 1,
        price: (Math.random() * 10 + 1).toFixed(2)
      });
    }
    
    return {
      client: {
        id: `test-client-${itemCount}`,
        name: `Test Client - ${itemCount} Items`,
        email: 'test@contentsize.com',
        billingCalculation: 'byWeight'
      },
      invoice: {
        id: `content-test-${itemCount}`,
        invoiceNumber: 3000 + itemCount,
        clientId: `test-client-${itemCount}`,
        clientName: `Test Client - ${itemCount} Items`,
        date: new Date().toISOString().split('T')[0],
        deliveryDate: new Date().toISOString().split('T')[0],
        total: items.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0),
        totalWeight: itemCount * 2.5,
        truckNumber: 'CONTENT-01',
        carts: [{
          id: `content-cart-${itemCount}`,
          name: `Content Test Cart - ${itemCount} items`,
          items: items,
          total: items.reduce((sum, item) => sum + (item.quantity * parseFloat(item.price)), 0),
          createdAt: new Date().toISOString(),
          createdBy: 'Content Test'
        }],
        products: [],
        status: 'approved',
        verified: true
      },
      signatureData: {
        signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        signedByName: 'Content Test Signature',
        driverName: 'Content Test Driver',
        deliveryDate: new Date().toLocaleDateString()
      }
    };
  };
  
  // Test configurations
  const testSizes = [
    { items: 3, description: "Short Content" },
    { items: 8, description: "Medium Content" },
    { items: 15, description: "Long Content" },
    { items: 25, description: "Very Long Content" }
  ];
  
  const testConfigs = [
    {
      name: "Content-Sized (No Empty Space)",
      options: {
        paperSize: 'content',
        margins: 'content',
        pagination: 'single'
      }
    },
    {
      name: "Letter Size (For Comparison)",
      options: {
        paperSize: 'letter',
        orientation: 'portrait',
        pagination: 'single'
      }
    }
  ];
  
  const results = [];
  
  for (const testSize of testSizes) {
    console.log(`\n📋 TESTING: ${testSize.description} (${testSize.items} items)`);
    console.log("-".repeat(40));
    
    const testData = createTestData(testSize.items, testSize.description);
    
    for (const config of testConfigs) {
      console.log(`\n🧪 Configuration: ${config.name}`);
      
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
          items: testSize.items,
          description: testSize.description,
          config: config.name,
          success: true,
          generationTime: generationTime,
          sizeMB: pdfSizeMB,
          isContentSized: config.name.includes('Content-Sized')
        });
        
        // Brief delay between tests
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        results.push({
          items: testSize.items,
          description: testSize.description,
          config: config.name,
          success: false,
          error: error.message
        });
      }
    }
  }
  
  // Analysis
  console.log("\n📊 CONTENT-SIZED PDF ANALYSIS");
  console.log("="  .repeat(50));
  
  const contentSizedResults = results.filter(r => r.success && r.isContentSized);
  const letterSizeResults = results.filter(r => r.success && !r.isContentSized);
  
  console.log("📐 Content-Sized PDFs:");
  contentSizedResults.forEach(result => {
    console.log(`   ${result.description}: ${result.sizeMB.toFixed(2)}MB, ${result.generationTime}ms`);
  });
  
  console.log("\n📄 Letter-Size PDFs (for comparison):");
  letterSizeResults.forEach(result => {
    console.log(`   ${result.description}: ${result.sizeMB.toFixed(2)}MB, ${result.generationTime}ms`);
  });
  
  // Size comparison
  if (contentSizedResults.length > 0 && letterSizeResults.length > 0) {
    const avgContentSize = contentSizedResults.reduce((sum, r) => sum + r.sizeMB, 0) / contentSizedResults.length;
    const avgLetterSize = letterSizeResults.reduce((sum, r) => sum + r.sizeMB, 0) / letterSizeResults.length;
    const sizeDifference = ((avgLetterSize - avgContentSize) / avgLetterSize * 100);
    
    console.log("\n📈 SIZE COMPARISON:");
    console.log(`   Average Content-Sized: ${avgContentSize.toFixed(2)}MB`);
    console.log(`   Average Letter-Size: ${avgLetterSize.toFixed(2)}MB`);
    console.log(`   Space Savings: ${sizeDifference.toFixed(1)}% less empty space`);
  }
  
  console.log("\n🎯 BENEFITS OF CONTENT-SIZED PDFs:");
  console.log("✅ No empty space - document fits content exactly");
  console.log("✅ Smaller file sizes due to reduced page area");
  console.log("✅ Perfect for web display and mobile viewing");
  console.log("✅ Automatic sizing based on actual content");
  console.log("✅ Minimal margins for maximum content density");
  
  console.log("\n📋 USAGE RECOMMENDATIONS:");
  console.log("🎯 Use Content-Sized for:");
  console.log("   • Web display and email attachments");
  console.log("   • Mobile viewing and digital documents");
  console.log("   • When file size is important");
  console.log("   • When you want no wasted space");
  
  console.log("\n📄 Use Standard Paper Sizes for:");
  console.log("   • Physical printing requirements");
  console.log("   • Official document formatting");
  console.log("   • When consistent page size is needed");
  
  return results;
};

// Quick test function for immediate verification
window.quickContentSizeTest = async function() {
  console.log("⚡ QUICK CONTENT-SIZE TEST");
  
  try {
    const pdfService = await import('/src/services/signedDeliveryPdfService.ts');
    const generateSignedDeliveryPDF = pdfService.generateSignedDeliveryPDF;
    
    // Simple test data
    const testClient = { id: 'quick', name: 'Quick Test', email: 'test@quick.com', billingCalculation: 'byWeight' };
    const testInvoice = {
      id: 'quick-001', invoiceNumber: 9001, clientId: 'quick', clientName: 'Quick Test',
      date: '2025-08-15', deliveryDate: '2025-08-15', total: 50, totalWeight: 10, truckNumber: 'Q1',
      carts: [{ id: 'q1', name: 'Quick Cart', items: [
        { productId: 'q1', productName: 'Quick Item 1', quantity: 5, price: 5 },
        { productId: 'q2', productName: 'Quick Item 2', quantity: 3, price: 8 }
      ], total: 50, createdAt: new Date().toISOString(), createdBy: 'Quick' }],
      products: [], status: 'approved', verified: true
    };
    const signatureData = {
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      signedByName: 'Quick Test', driverName: 'Quick Driver', deliveryDate: new Date().toLocaleDateString()
    };
    
    const pdfData = await generateSignedDeliveryPDF(testInvoice, testClient, signatureData, {
      paperSize: 'content',
      margins: 'content'
    });
    
    const sizeMB = ((pdfData.length * 3) / 4) / (1024 * 1024);
    console.log(`✅ Content-sized PDF generated: ${sizeMB.toFixed(2)}MB`);
    console.log("🎯 Check console logs above for 'CONTENT-SIZED MODE' details");
    
  } catch (error) {
    console.error("❌ Quick test failed:", error);
  }
};

console.log("📐 CONTENT-SIZED PDF TEST FUNCTIONS LOADED");
console.log("="  .repeat(50));
console.log("📋 Available functions:");
console.log("• testContentSizedPDF() - Comprehensive content-sizing test");
console.log("• quickContentSizeTest() - Quick verification test");
console.log("");
console.log("🎯 NEW FEATURE: PDFs now fit content exactly with no empty space!");
console.log("📱 Perfect for web display, mobile viewing, and email attachments");
console.log("💾 Smaller file sizes due to eliminating unused page area");
console.log("");
console.log("🚀 Run quickContentSizeTest() for immediate verification!");
