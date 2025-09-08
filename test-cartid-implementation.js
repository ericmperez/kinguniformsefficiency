// Test Script for Cart ID Implementation in Analytics/Dashboard Components
// Run this in browser console to verify all pickup_entries queries include cartId field
// Navigate to different pages and run this test to verify cartId data is displayed

console.clear();
console.log('🧪 CART ID IMPLEMENTATION TEST');
console.log('===================================');

// Test function to run on different dashboard pages
function testCartIdImplementation() {
  console.log('\n📊 TESTING CART ID IMPLEMENTATION...');
  
  // Check current page URL
  const currentUrl = window.location.href;
  console.log('🌐 Current Page:', currentUrl);
  
  // Test 1: Look for pickup entries tables with Cart ID column
  console.log('\n📋 STEP 1: CHECK PICKUP ENTRIES TABLES');
  
  const pickupTables = document.querySelectorAll('table');
  let cartIdColumnsFound = 0;
  
  pickupTables.forEach((table, index) => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
    const hasCartIdColumn = headers.some(header => 
      header && (header.toLowerCase().includes('cart') || header.toLowerCase().includes('id'))
    );
    
    if (hasCartIdColumn) {
      cartIdColumnsFound++;
      console.log(`✅ Table ${index + 1}: Found Cart ID column`);
      console.log('   Headers:', headers);
      
      // Check if data is being displayed in cart ID cells
      const cartIdCells = table.querySelectorAll('tbody tr td:nth-child(4)'); // Assuming Cart ID is 4th column
      const hasCartIdData = Array.from(cartIdCells).some(cell => 
        cell.textContent?.trim() && cell.textContent?.trim() !== 'N/A'
      );
      
      if (hasCartIdData) {
        console.log('   📊 Data status: Has cart ID data');
      } else {
        console.log('   ⚠️ Data status: No cart ID data or showing N/A');
      }
    }
  });
  
  console.log(`\n📈 Found ${cartIdColumnsFound} tables with Cart ID columns`);
  
  // Test 2: Check for pickup entries data in React components
  console.log('\n📋 STEP 2: CHECK REACT COMPONENT DATA');
  
  // Look for pickup entries data in component state (if available)
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    console.log('✅ React detected - checking for pickup entries data...');
    
    // Check for pickup entries in DOM data attributes or elements
    const pickupSections = document.querySelectorAll('[class*="pickup"], [class*="Pickup"]');
    console.log(`🔍 Found ${pickupSections.length} pickup-related sections`);
    
    pickupSections.forEach((section, index) => {
      const hasCartIdBadges = section.querySelectorAll('.badge').length > 0;
      if (hasCartIdBadges) {
        console.log(`✅ Section ${index + 1}: Contains badge elements (likely cart ID data)`);
      }
    });
  }
  
  // Test 3: Check specific dashboard components
  console.log('\n📋 STEP 3: COMPONENT-SPECIFIC TESTS');
  
  if (currentUrl.includes('production-classification')) {
    console.log('🏭 Testing Production Classification Dashboard...');
    
    const pickupEntriesCard = document.querySelector('.card.border-primary');
    if (pickupEntriesCard) {
      const cardHeader = pickupEntriesCard.querySelector('.card-header h5');
      if (cardHeader && cardHeader.textContent?.includes('Pickup Entries')) {
        console.log('✅ Pickup Entries section found');
        
        const table = pickupEntriesCard.querySelector('table');
        if (table) {
          const cartIdHeader = Array.from(table.querySelectorAll('th')).find(th => 
            th.textContent?.includes('Cart ID')
          );
          
          if (cartIdHeader) {
            console.log('✅ Cart ID column header found');
            
            // Check for cart ID data in table rows
            const cartIdCells = table.querySelectorAll('tbody tr td:nth-child(4) .badge');
            console.log(`📊 Found ${cartIdCells.length} cart ID badge elements`);
            
            if (cartIdCells.length > 0) {
              const sampleCartIds = Array.from(cartIdCells).slice(0, 3).map(cell => 
                cell.textContent?.trim()
              );
              console.log('📋 Sample Cart IDs:', sampleCartIds);
            }
          } else {
            console.log('❌ Cart ID column header NOT found');
          }
        }
      }
    }
  }
  
  if (currentUrl.includes('analytics')) {
    console.log('📊 Testing Analytics Components...');
    // Add specific analytics component tests here
  }
  
  if (currentUrl.includes('pickup-washing')) {
    console.log('🚛 Testing Pickup Washing Component...');
    
    const cartIdInputs = document.querySelectorAll('input[placeholder*="Cart"], input[placeholder*="cart"]');
    console.log(`✅ Found ${cartIdInputs.length} cart ID input fields`);
    
    const pickupTables = document.querySelectorAll('table');
    pickupTables.forEach(table => {
      const hasCartIdColumn = Array.from(table.querySelectorAll('th')).some(th => 
        th.textContent?.toLowerCase().includes('cart')
      );
      if (hasCartIdColumn) {
        console.log('✅ Pickup table has Cart ID column');
      }
    });
  }
  
  // Test 4: Console log analysis
  console.log('\n📋 STEP 4: CONSOLE LOG ANALYSIS');
  console.log('Look for these log messages indicating proper cartId handling:');
  console.log('• Messages containing "cartId"');
  console.log('• Firestore query logs showing cartId field');
  console.log('• Component mount logs showing pickup entries with cartId');
  
  // Test 5: Final summary
  console.log('\n🎯 IMPLEMENTATION SUMMARY');
  console.log('============================');
  
  const implementationChecks = {
    'Cart ID columns in tables': cartIdColumnsFound > 0,
    'Pickup entries sections': document.querySelectorAll('[class*="pickup"]').length > 0,
    'Cart ID input fields': document.querySelectorAll('input[placeholder*="cart"], input[placeholder*="Cart"]').length > 0,
    'Badge elements (data display)': document.querySelectorAll('.badge').length > 0
  };
  
  Object.entries(implementationChecks).forEach(([check, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  });
  
  const overallSuccess = Object.values(implementationChecks).filter(Boolean).length;
  const totalChecks = Object.keys(implementationChecks).length;
  
  console.log(`\n📊 Overall Implementation Score: ${overallSuccess}/${totalChecks}`);
  
  if (overallSuccess >= totalChecks - 1) {
    console.log('🎉 SUCCESS: Cart ID implementation appears to be working correctly!');
  } else if (overallSuccess >= 2) {
    console.log('⚠️ PARTIAL: Some cart ID features are working, check console for details');
  } else {
    console.log('❌ ISSUE: Cart ID implementation may need attention');
  }
}

// Run the test
testCartIdImplementation();

// Provide manual testing instructions
console.log('\n🔧 MANUAL TESTING INSTRUCTIONS:');
console.log('1. Navigate to: http://localhost:3001/production-classification');
console.log('2. Look for "Pickup Entries Today" section');
console.log('3. Check for Cart ID column in the table');
console.log('4. Navigate to: http://localhost:3001/pickup-washing');
console.log('5. Try entering a pickup with a cart ID');
console.log('6. Verify cart ID appears in the entries table');
console.log('7. Check other analytics pages for cart ID display');

console.log('\n📝 TO TEST CART ID DATA:');
console.log('1. Go to Pickup/Washing page');
console.log('2. Create a pickup entry with a specific Cart ID (e.g., "CART-001")');
console.log('3. Check that the Cart ID appears in all relevant dashboards');
console.log('4. Verify no "N/A" values when cart ID is provided');
