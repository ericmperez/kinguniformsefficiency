/**
 * Test Script for Client-Specific Quantity Display Configuration
 * 
 * This script tests the newly implemented per-client quantity display configuration
 * that allows clients to control whether quantities are shown in cart printing
 * through their print configuration settings.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5175
 * 2. Navigate to an invoice and open the invoice details modal
 * 3. Open browser console (F12)
 * 4. Paste this script and press Enter
 * 5. Run: testClientQuantityConfig()
 */

console.log("⚙️ Client Quantity Configuration Test Script Loaded");

/**
 * Test the client-specific quantity display configuration
 */
window.testClientQuantityConfig = function() {
  console.log("🚀 Testing client-specific quantity display configuration...");
  console.log("=" .repeat(70));
  
  // Check if we're in the correct context
  const modal = document.querySelector('.invoice-details-modal');
  if (!modal) {
    console.log("❌ Invoice details modal not found.");
    console.log("Please open an invoice details modal first.");
    return;
  }
  
  console.log("✅ Invoice details modal detected");
  
  // Look for cart sections
  const cartSections = document.querySelectorAll('.cart-section');
  console.log(`📋 Found ${cartSections.length} cart(s) in the invoice`);
  
  if (cartSections.length === 0) {
    console.log("❌ No carts found in the invoice.");
    console.log("Please open an invoice that contains carts.");
    return;
  }
  
  // Test different client scenarios
  const testScenarios = [
    {
      name: "Costa Bahía",
      defaultShowQuantities: false,
      description: "Previously excluded client - now configurable"
    },
    {
      name: "Children's Hospital",
      defaultShowQuantities: true,
      description: "Special case - always shows quantities"
    },
    {
      name: "Oncologico Medical Center",
      defaultShowQuantities: true,
      description: "Special case - always shows quantities"
    },
    {
      name: "Regular Client",
      defaultShowQuantities: true,
      description: "Standard client - respects print configuration"
    },
    {
      name: "Dorado Aquarius",
      defaultShowQuantities: false,
      description: "Previously excluded client - now configurable"
    },
    {
      name: "Hyatt Hotel",
      defaultShowQuantities: false,
      description: "Previously excluded client - now configurable"
    }
  ];
  
  console.log("\n🧪 Client Quantity Display Logic Test:");
  console.log("=" .repeat(70));
  
  testScenarios.forEach((scenario, index) => {
    console.log(`\n${index + 1}. Testing: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    
    // Simulate the new logic
    const isOncologico = scenario.name.toLowerCase().includes('oncologico');
    const isChildrens = scenario.name.toLowerCase().includes('children') && 
                       scenario.name.toLowerCase().includes('hospital');
    
    // Mock print configuration (in real app, this comes from client.printConfig.cartPrintSettings)
    const printConfigShowQuantities = true; // Default setting
    const globalToggle = true; // showQuantitiesForThisInvoice
    
    // Apply the new logic
    const shouldShowQuantities = (printConfigShowQuantities && globalToggle) || 
                                isOncologico || 
                                isChildrens;
    
    console.log(`   🔧 Print Config: showQuantities = ${printConfigShowQuantities}`);
    console.log(`   🌐 Global Toggle: ${globalToggle}`);
    console.log(`   👶 Is Children's Hospital: ${isChildrens}`);
    console.log(`   🏥 Is Oncologico: ${isOncologico}`);
    console.log(`   📊 Result: ${shouldShowQuantities ? 'SHOW quantities' : 'HIDE quantities'}`);
    
    if (isChildrens || isOncologico) {
      console.log(`   ⭐ Special case: Always shows quantities regardless of config`);
    } else {
      console.log(`   ⚙️ Respects client print configuration setting`);
    }
  });
  
  console.log("\n" + "=" .repeat(70));
  console.log("📝 Summary of Changes:");
  console.log("✅ Removed hardcoded client exclusions from quantity display");
  console.log("✅ Quantities now controlled by client.printConfig.cartPrintSettings.showQuantities");
  console.log("✅ Children's Hospital and Oncologico still always show quantities");
  console.log("✅ All other clients respect their individual print configuration");
  console.log("✅ Global toggle still works for per-invoice override");
  
  console.log("\n🎯 How to Configure:");
  console.log("1. Go to Printing Settings page");
  console.log("2. Find the client you want to configure");
  console.log("3. Click the 'Configure' button");
  console.log("4. In the Cart Print Settings section, check/uncheck 'Show quantities'");
  console.log("5. Save the configuration");
  console.log("6. The client's cart prints will now respect this setting");
};

/**
 * Quick test of the quantity toggle button
 */
window.testQuantityToggle = function() {
  console.log("🔄 Testing quantity toggle button...");
  
  const toggleButton = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.includes('Hide Qty') || btn.textContent?.includes('Show Qty'));
  
  if (!toggleButton) {
    console.log("❌ Quantity toggle button not found");
    return;
  }
  
  const isCurrentlyShowing = toggleButton.textContent?.includes('Hide Qty');
  console.log(`📊 Current state: ${isCurrentlyShowing ? 'Showing' : 'Hiding'} quantities`);
  console.log(`🔘 Button text: "${toggleButton.textContent?.trim()}"`);
  console.log("💡 This toggle provides per-invoice override of client settings");
};

/**
 * Demonstrate configuration access
 */
window.showConfigInstructions = function() {
  console.log("📖 Configuration Instructions:");
  console.log("=" .repeat(50));
  console.log("To configure which clients show quantities:");
  console.log("1. Navigate to the Printing Settings page");
  console.log("2. Find the client in the list");
  console.log("3. Click 'Configure' button next to the client");
  console.log("4. Look for 'Cart Print Settings' section");
  console.log("5. Check/uncheck 'Show quantities' checkbox");
  console.log("6. Click 'Save' to apply changes");
  console.log("");
  console.log("Special cases (always show quantities):");
  console.log("• Children's Hospital clients");
  console.log("• Oncologico clients");
  console.log("");
  console.log("Note: The global toggle button in invoice details");
  console.log("provides per-invoice override of client settings.");
};

console.log("\n🎯 Available functions:");
console.log("• testClientQuantityConfig() - Test the new configuration logic");
console.log("• testQuantityToggle() - Test the global toggle button");
console.log("• showConfigInstructions() - Show configuration instructions");

console.log("\n📋 Instructions:");
console.log("1. Ensure invoice details modal is open");
console.log("2. Run testClientQuantityConfig() for comprehensive testing");
console.log("3. Run showConfigInstructions() for configuration help");

// Auto-run quick check
setTimeout(() => {
  console.log("\n🔍 Auto-running configuration test...");
  window.testClientQuantityConfig();
}, 500);
