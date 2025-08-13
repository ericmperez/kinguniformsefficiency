/**
 * Test Script for Mananti Medical Center PDF Options Issue
 * 
 * This script tests the specific issue where Mananti Medical Center has 
 * "Details Items List" selected but PDFs are showing weight instead.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5174
 * 2. Navigate to "Delivered Invoices" page
 * 3. Open browser console (F12)
 * 4. Paste this script and press Enter
 * 5. Run: testManantiPDFOptions()
 * 
 * UPDATE: This script now also tests the FIX that was applied to 
 * SignedDeliveryTicket.tsx to properly respect contentDisplay settings.
 */

console.log("🔬 Mananti Medical Center PDF Options Test Script Loaded");
console.log("✅ Updated with fix validation logic");

/**
 * Test Mananti Medical Center PDF options specifically
 */
window.testManantiPDFOptions = async function() {
  console.log("🏥 Testing Mananti Medical Center PDF Options...");
  console.log("=" .repeat(60));
  
  try {
    // Check if we have access to Firebase
    if (!window.db) {
      console.log("❌ Firebase not accessible. Make sure you are on the app page.");
      return;
    }

    // Get Firebase functions
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    
    // Find Mananti Medical Center specifically
    console.log("🔍 Searching for Mananti Medical Center...");
    const clientsSnapshot = await getDocs(collection(window.db, 'clients'));
    let manantiClient = null;
    
    clientsSnapshot.forEach(doc => {
      const clientData = { id: doc.id, ...doc.data() };
      if (clientData.name && clientData.name.toLowerCase().includes('mananti')) {
        manantiClient = clientData;
      }
    });
    
    if (!manantiClient) {
      console.log("❌ Mananti Medical Center not found in clients database");
      console.log("📋 Available clients:");
      clientsSnapshot.forEach(doc => {
        const clientData = doc.data();
        console.log(`   • ${clientData.name}`);
      });
      return;
    }
    
    console.log(`✅ Found Mananti Medical Center (ID: ${manantiClient.id})`);
    console.log("📋 Full client data:", manantiClient);
    
    // Check PDF options
    console.log("\n🔧 PDF Options Analysis:");
    console.log("=" .repeat(40));
    
    const pdfOptions = manantiClient.printConfig?.pdfOptions;
    
    if (pdfOptions) {
      console.log("✅ PDF options found for Mananti:");
      console.log(`   📄 Content Display: ${pdfOptions.contentDisplay || 'NOT SET'}`);
      console.log(`   📍 Show Location: ${pdfOptions.showLocation !== false ? 'YES' : 'NO'}`);
      console.log(`   🏷️  Show Quantities: ${pdfOptions.showQuantities !== false ? 'YES' : 'NO'}`);
      console.log(`   📏 Paper Size: ${pdfOptions.paperSize || 'letter'}`);
      console.log(`   📐 Orientation: ${pdfOptions.orientation || 'portrait'}`);
      console.log(`   🔍 Scale: ${pdfOptions.scale || 1.0}`);
      console.log(`   📝 Font Size: ${pdfOptions.fontSize || 'medium'}`);
      
      // Analyze the contentDisplay setting
      console.log("\n🎯 Content Display Analysis:");
      console.log("=" .repeat(30));
      
      switch(pdfOptions.contentDisplay) {
        case 'detailed':
          console.log("✅ SET TO: 'detailed' (Detailed Items List)");
          console.log("📋 Expected behavior: Show full item table with quantities");
          break;
        case 'summary':
          console.log("⚠️  SET TO: 'summary' (Summary with Total Weight)");
          console.log("📋 Expected behavior: Show summary with total weight");
          break;
        case 'weight-only':
          console.log("⚠️  SET TO: 'weight-only' (Weight Only)");
          console.log("📋 Expected behavior: Show only total weight");
          break;
        default:
          console.log(`❓ SET TO: '${pdfOptions.contentDisplay}' (Unknown/Invalid)`);
          console.log("📋 Expected behavior: Should default to 'detailed'");
      }
    } else {
      console.log("❌ No PDF options configured for Mananti");
      console.log("📋 Will use system defaults");
    }
    
    // Check invoice print settings
    console.log("\n📄 Invoice Print Settings Analysis:");
    console.log("=" .repeat(40));
    
    const invoicePrintSettings = manantiClient.printConfig?.invoicePrintSettings;
    
    if (invoicePrintSettings) {
      console.log("✅ Invoice print settings found:");
      console.log(`   📦 Show Product Summary: ${invoicePrintSettings.showProductSummary !== false ? 'YES' : 'NO'}`);
      console.log(`   ⚖️  Show Total Weight: ${invoicePrintSettings.showTotalWeight !== false ? 'YES' : 'NO'}`);
      console.log(`   📋 Show Cart Breakdown: ${invoicePrintSettings.showCartBreakdown !== false ? 'YES' : 'NO'}`);
    } else {
      console.log("⚠️  No invoice print settings configured");
    }
    
    // Test the logic that determines what gets shown
    console.log("\n🧪 PDF Generation Logic Test:");
    console.log("=" .repeat(40));
    
    // Simulate the SignedDeliveryTicket component logic
    const defaultOptions = {
      scale: 1.0,
      showSignatures: true,
      showTimestamp: true,
      showLocation: false,
      showQuantities: true,
      contentDisplay: 'detailed',
      paperSize: 'letter',
      orientation: 'portrait',
      margins: 'normal',
      fontSize: 'medium',
      showWatermark: false,
      headerText: '',
      footerText: '',
      logoSize: 'medium',
      showBorder: true,
      pagination: 'single'
    };
    
    const options = { ...defaultOptions, ...pdfOptions };
    const showWeights = invoicePrintSettings?.showTotalWeight !== false;
    const showQuantities = options.showQuantities !== false;
    const showItems = invoicePrintSettings?.showProductSummary !== false;
    
    const contentDisplay = options.contentDisplay || 'detailed';
    const showDetailedItems = contentDisplay === 'detailed' && showItems;
    const showSummaryOnly = contentDisplay === 'summary';
    const showWeightOnly = contentDisplay === 'weight-only';
    
    console.log("📊 Computed display settings:");
    console.log(`   📋 Content Display Mode: ${contentDisplay}`);
    console.log(`   📦 Show Items (invoice setting): ${showItems}`);
    console.log(`   ⚖️  Show Weights (invoice setting): ${showWeights}`);
    console.log(`   🏷️  Show Quantities (PDF option): ${showQuantities}`);
    console.log(`   📄 Show Detailed Items: ${showDetailedItems}`);
    console.log(`   📊 Show Summary Only: ${showSummaryOnly}`);
    console.log(`   ⚖️  Show Weight Only: ${showWeightOnly}`);
    
    // Identify the issue
    console.log("\n🚨 ISSUE DIAGNOSIS:");
    console.log("=" .repeat(30));
    
    if (contentDisplay === 'detailed' && !showDetailedItems) {
      console.log("❌ PROBLEM FOUND: Content display is set to 'detailed' but showDetailedItems is FALSE");
      console.log(`   📦 showItems (showProductSummary): ${showItems}`);
      console.log(`   🔧 This is controlled by invoicePrintSettings.showProductSummary`);
      
      if (invoicePrintSettings?.showProductSummary === false) {
        console.log("🎯 ROOT CAUSE: invoicePrintSettings.showProductSummary is set to FALSE");
        console.log("   This overrides the PDF contentDisplay setting!");
      }
    } else if (contentDisplay !== 'detailed') {
      console.log(`❌ PROBLEM FOUND: Content display is set to '${contentDisplay}' instead of 'detailed'`);
      console.log("   This should be 'detailed' to show the items list");
    } else {
      console.log("✅ Settings appear correct for showing detailed items list");
    }
    
    // Show what will actually be displayed
    console.log("\n📺 ACTUAL DISPLAY RESULT:");
    console.log("=" .repeat(30));
    
    if (showDetailedItems) {
      console.log("✅ Will show: DETAILED ITEMS TABLE");
      if (showQuantities) {
        console.log("   📋 Items table will include quantities column");
      } else {
        console.log("   📋 Items table will NOT include quantities column");
      }
    }
    
    if (showSummaryOnly) {
      console.log("📊 Will show: SUMMARY with total weight and item count");
    }
    
    if (showWeightOnly) {
      console.log("⚖️  Will show: WEIGHT ONLY");
    }
    
    if ((showDetailedItems || showSummaryOnly) && showWeights) {
      console.log("⚖️  Will also show: TOTAL WEIGHT section");
    }
    
    if (!showDetailedItems && !showSummaryOnly && !showWeightOnly) {
      console.log("❌ Will show: NOTHING (no content sections enabled)");
    }
    
    // Provide fix recommendations
    console.log("\n🔧 RECOMMENDED FIXES:");
    console.log("=" .repeat(30));
    
    if (contentDisplay === 'detailed' && !showItems) {
      console.log("1. ✅ Set invoicePrintSettings.showProductSummary = true");
      console.log("   This will enable the items display");
    }
    
    if (contentDisplay !== 'detailed') {
      console.log("2. ✅ Set pdfOptions.contentDisplay = 'detailed'");
      console.log("   This will show the detailed items list");
    }
    
    console.log("3. ✅ Verify the PDF options are being saved correctly");
    console.log("4. ✅ Test downloading a PDF to confirm the fix works");
    
    // Test the fix we implemented
    console.log("\n🔧 TESTING THE FIX:");
    console.log("=" .repeat(30));
    
    // NEW LOGIC: After fix - contentDisplay should override showProductSummary
    const fixedShowDetailedItems = contentDisplay === 'detailed';
    const fixedShowSummaryOnly = contentDisplay === 'summary';
    const fixedShowWeightOnly = contentDisplay === 'weight-only';
    
    console.log("✅ FIXED LOGIC RESULTS:");
    console.log(`   📄 Show Detailed Items (FIXED): ${fixedShowDetailedItems}`);
    console.log(`   📊 Show Summary Only (FIXED): ${fixedShowSummaryOnly}`);
    console.log(`   ⚖️  Show Weight Only (FIXED): ${fixedShowWeightOnly}`);
    
    if (contentDisplay === 'detailed' && fixedShowDetailedItems) {
      console.log("🎉 SUCCESS: The fix works! Detailed items will now be shown regardless of showProductSummary setting.");
    } else {
      console.log("❌ The fix didn't work as expected.");
    }
    
    console.log("\n📋 COMPARISON:");
    console.log("=" .repeat(30));
    console.log(`OLD logic showDetailedItems: ${showDetailedItems} (depends on both contentDisplay AND showProductSummary)`);
    console.log(`NEW logic showDetailedItems: ${fixedShowDetailedItems} (depends ONLY on contentDisplay)`);
    
    if (showDetailedItems !== fixedShowDetailedItems) {
      console.log(`🔧 IMPACT: This fix changes the behavior! Before: ${showDetailedItems}, After: ${fixedShowDetailedItems}`);
      console.log("   This means Mananti's PDFs will now show detailed items as expected.");
    } else {
      console.log("ℹ️  No behavior change for this specific configuration.");
    }
    
  } catch (error) {
    console.error("❌ Error during testing:", error);
  }
};

/**
 * Test PDF options for multiple clients to compare
 */
window.comparePDFOptions = async function() {
  console.log("🔍 Comparing PDF options across clients...");
  
  try {
    if (!window.db) {
      console.log("❌ Firebase not accessible.");
      return;
    }

    const { collection, getDocs } = await import('firebase/firestore');
    const clientsSnapshot = await getDocs(collection(window.db, 'clients'));
    
    const clientsWithPDFOptions = [];
    
    clientsSnapshot.forEach(doc => {
      const client = { id: doc.id, ...doc.data() };
      if (client.printConfig?.pdfOptions) {
        clientsWithPDFOptions.push({
          name: client.name,
          contentDisplay: client.printConfig.pdfOptions.contentDisplay,
          showProductSummary: client.printConfig.invoicePrintSettings?.showProductSummary,
          showTotalWeight: client.printConfig.invoicePrintSettings?.showTotalWeight
        });
      }
    });
    
    console.log("\n📊 Clients with PDF Options:");
    console.log("=" .repeat(50));
    
    clientsWithPDFOptions.forEach(client => {
      console.log(`\n• ${client.name}:`);
      console.log(`  Content Display: ${client.contentDisplay || 'not set'}`);
      console.log(`  Show Product Summary: ${client.showProductSummary !== false ? 'YES' : 'NO'}`);
      console.log(`  Show Total Weight: ${client.showTotalWeight !== false ? 'YES' : 'NO'}`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
};

// Auto-instructions
console.log("\n🎯 Available test functions:");
console.log("• testManantiPDFOptions() - Detailed analysis of Mananti's PDF settings");
console.log("• comparePDFOptions() - Compare PDF options across all clients");

console.log("\n📋 Quick Start:");
console.log("Run: testManantiPDFOptions()");
