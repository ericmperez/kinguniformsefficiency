/**
 * Debug Script for Nudos (Sabanas) Column Visibility Issue
 * 
 * This script investigates why the "Nudos (Sabanas)" column is not visible 
 * for Doctor Center Manati client despite being configured with a price.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5181/
 * 2. Navigate to "Billing" page
 * 3. Open browser console (F12)
 * 4. Paste this script and press Enter
 * 5. Run: debugNudosSabanasIssue()
 */

console.log("🔬 Nudos (Sabanas) Debug Script Loaded");

/**
 * Debug the Nudos (Sabanas) visibility issue
 */
window.debugNudosSabanasIssue = async function() {
  console.log("🏥 Debugging Nudos (Sabanas) Column Visibility Issue...");
  console.log("=" .repeat(70));
  
  try {
    // Check if we have access to Firebase
    if (!window.db) {
      console.log("❌ Firebase not accessible. Make sure you are on the billing page.");
      return;
    }

    // Get Firebase functions
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    
    // Find Doctor Center Manati specifically
    console.log("🔍 Searching for Doctor Center Manati...");
    const clientsSnapshot = await getDocs(collection(window.db, 'clients'));
    let manantiClient = null;
    
    clientsSnapshot.forEach(doc => {
      const clientData = { id: doc.id, ...doc.data() };
      const name = clientData.name?.toLowerCase() || '';
      if (name.includes('manati') || name.includes('mananti') || name.includes('doctor center')) {
        console.log(`🎯 Found potential match: "${clientData.name}" (ID: ${clientData.id})`);
        if (!manantiClient || name.includes('manati')) {
          manantiClient = clientData;
        }
      }
    });
    
    if (!manantiClient) {
      console.log("❌ Doctor Center Manati not found in clients database");
      console.log("📋 Available clients containing 'doctor', 'center', or 'manati':");
      clientsSnapshot.forEach(doc => {
        const clientData = doc.data();
        const name = clientData.name?.toLowerCase() || '';
        if (name.includes('doctor') || name.includes('center') || name.includes('manati')) {
          console.log(`   • ${clientData.name} (ID: ${doc.id})`);
        }
      });
      return;
    }

    console.log(`✅ Found Doctor Center Manati: "${manantiClient.name}" (ID: ${manantiClient.id})`);
    
    // Check client's minimum billing configuration (where nudosSabanasPrice is stored)
    console.log("\n💰 Checking Client Billing Configuration:");
    console.log("=" .repeat(50));
    
    const billingDocRef = collection(window.db, 'client_minimum_billing');
    const billingQuery = query(billingDocRef, where('clientId', '==', manantiClient.id));
    const billingSnapshot = await getDocs(billingQuery);
    
    let billingConfig = null;
    if (!billingSnapshot.empty) {
      billingConfig = billingSnapshot.docs[0].data();
      console.log("✅ Billing configuration found:");
      console.log("📋 Full configuration:", billingConfig);
      
      // Specifically check nudosSabanasPrice
      const nudosSabanasPrice = billingConfig.nudosSabanasPrice;
      console.log(`\n🎯 Nudos (Sabanas) Price: ${nudosSabanasPrice}`);
      console.log(`   Type: ${typeof nudosSabanasPrice}`);
      console.log(`   Is > 0?: ${Number(nudosSabanasPrice) > 0}`);
      console.log(`   Is truthy?: ${!!nudosSabanasPrice}`);
      console.log(`   Condition result: ${nudosSabanasPrice && Number(nudosSabanasPrice) > 0}`);
      
      // Check the formula
      const nudosSabanasFormula = billingConfig.nudosSabanasFormula || 'perUnit';
      console.log(`   Formula: ${nudosSabanasFormula}`);
      
    } else {
      console.log("❌ No billing configuration found for this client");
      console.log("💡 This is why the Nudos (Sabanas) column is not visible!");
      console.log("📝 The client needs billing configuration with nudosSabanasPrice > 0");
    }
    
    // Check if client has sabanas products configured
    console.log("\n📦 Checking Client Product Configuration:");
    console.log("=" .repeat(50));
    
    if (manantiClient.selectedProducts && manantiClient.selectedProducts.length > 0) {
      console.log(`✅ Client has ${manantiClient.selectedProducts.length} products configured`);
      
      // Get all products to check for sabanas
      const productsSnapshot = await getDocs(collection(window.db, 'products'));
      const allProducts = {};
      productsSnapshot.forEach(doc => {
        allProducts[doc.id] = { id: doc.id, ...doc.data() };
      });
      
      const clientProducts = manantiClient.selectedProducts.map(id => allProducts[id]).filter(Boolean);
      const sabanasProducts = clientProducts.filter(p => 
        p.name.toLowerCase().includes('sabana') && !p.name.toLowerCase().includes('nudo')
      );
      
      console.log("🛏️  Sabanas products found:");
      if (sabanasProducts.length > 0) {
        sabanasProducts.forEach(p => {
          console.log(`   • ${p.name} (ID: ${p.id})`);
        });
      } else {
        console.log("   ❌ No sabanas products found for this client");
        console.log("   💡 Without sabanas products, Nudos (Sabanas) charges cannot be calculated");
      }
      
    } else {
      console.log("❌ Client has no products configured");
    }
    
    // Check current page state if on billing page
    console.log("\n🖥️  Current Page State Check:");
    console.log("=" .repeat(40));
    
    // Check if we're on the billing page and if the client is selected
    const clientSelector = document.querySelector('select');
    if (clientSelector) {
      const selectedClientId = clientSelector.value;
      console.log(`📋 Currently selected client ID: ${selectedClientId}`);
      console.log(`🎯 Is Manati selected?: ${selectedClientId === manantiClient.id}`);
      
      if (selectedClientId === manantiClient.id) {
        // Check if Nudos (Sabanas) column is visible
        const nudosColumn = Array.from(document.querySelectorAll('th'))
          .find(th => th.textContent.includes('Nudos (Sabanas)'));
        
        console.log(`👁️  Nudos (Sabanas) column visible: ${nudosColumn ? 'YES' : 'NO'}`);
        
        if (!nudosColumn && billingConfig && Number(billingConfig.nudosSabanasPrice) > 0) {
          console.log("🚨 INCONSISTENCY DETECTED!");
          console.log("   Configuration shows price > 0 but column is not visible");
          console.log("   This suggests a frontend state synchronization issue");
        }
      } else {
        console.log("💡 Select Doctor Center Manati in the client dropdown to test visibility");
      }
    }
    
    // Provide diagnosis and recommendations
    console.log("\n🔍 DIAGNOSIS:");
    console.log("=" .repeat(20));
    
    if (!billingConfig) {
      console.log("❌ ROOT CAUSE: No billing configuration found");
      console.log("📝 SOLUTION: Create billing configuration with nudosSabanasPrice > 0");
    } else if (!billingConfig.nudosSabanasPrice || Number(billingConfig.nudosSabanasPrice) <= 0) {
      console.log("❌ ROOT CAUSE: nudosSabanasPrice is not set or is 0");
      console.log(`   Current value: ${billingConfig.nudosSabanasPrice}`);
      console.log("📝 SOLUTION: Set nudosSabanasPrice to a value > 0 in client configuration");
    } else {
      console.log("✅ Configuration appears correct");
      console.log("💡 Check if there's a frontend state synchronization issue");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
};

/**
 * Quick fix to set Nudos (Sabanas) price for Doctor Center Manati
 */
window.fixManantiNudosSabanas = async function(price = 2.50) {
  console.log(`🔧 Setting Nudos (Sabanas) price to $${price} for Doctor Center Manati...`);
  
  try {
    if (!window.db) {
      console.log("❌ Firebase not accessible");
      return;
    }
    
    // Find the client first
    const { collection, getDocs, doc, setDoc } = await import('firebase/firestore');
    const clientsSnapshot = await getDocs(collection(window.db, 'clients'));
    let manantiClient = null;
    
    clientsSnapshot.forEach(docSnap => {
      const clientData = { id: docSnap.id, ...docSnap.data() };
      const name = clientData.name?.toLowerCase() || '';
      if (name.includes('manati') || name.includes('doctor center')) {
        manantiClient = clientData;
      }
    });
    
    if (!manantiClient) {
      console.log("❌ Doctor Center Manati not found");
      return;
    }
    
    // Update or create billing configuration
    const billingDocRef = doc(window.db, 'client_minimum_billing', manantiClient.id);
    
    // Get existing config first
    const { getDoc } = await import('firebase/firestore');
    const existingDoc = await getDoc(billingDocRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};
    
    // Update with new nudosSabanasPrice
    await setDoc(billingDocRef, {
      ...existingData,
      clientId: manantiClient.id,
      nudosSabanasPrice: price,
      nudosSabanasFormula: existingData.nudosSabanasFormula || 'perUnit',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    console.log(`✅ Successfully set Nudos (Sabanas) price to $${price}`);
    console.log("🔄 Refresh the page or reselect the client to see changes");
    
  } catch (error) {
    console.error("❌ Error updating configuration:", error);
  }
};

// Auto-instructions
console.log("\n🎯 Available debug functions:");
console.log("• debugNudosSabanasIssue() - Comprehensive diagnosis");
console.log("• fixManantiNudosSabanas(price) - Quick fix to set the price");

console.log("\n📋 Quick Start:");
console.log("1. Run debugNudosSabanasIssue() to diagnose the issue");
console.log("2. If price is missing, run fixManantiNudosSabanas(2.50) to set it");
console.log("3. Refresh page and check if column appears");
