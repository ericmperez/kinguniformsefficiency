// Comprehensive segregation visibility diagnostic script
// Run this in the browser console when on the Production Classification Dashboard

console.log('🔍 SEGREGATION VISIBILITY DIAGNOSTIC');
console.log('=====================================');

// Step 1: Check if we're on the right page
const currentUrl = window.location.href;
console.log(`📍 Current URL: ${currentUrl}`);

if (!currentUrl.includes('productionClassification')) {
  console.warn('⚠️ Not on Production Classification Dashboard page');
  console.log('Please navigate to the Production Classification Dashboard first');
} else {
  console.log('✅ On correct page');
}

console.log('\n🔍 STEP 1: DOM STRUCTURE ANALYSIS');
console.log('================================');

// Find all cards
const allCards = document.querySelectorAll('.card');
console.log(`📊 Total cards found: ${allCards.length}`);

// List all card headers
console.log('\n📋 Card Headers Found:');
allCards.forEach((card, index) => {
  const header = card.querySelector('.card-header h5, .card-header .mb-0');
  const headerText = header ? header.textContent.trim() : 'No header';
  console.log(`  ${index + 1}. "${headerText}"`);
});

console.log('\n🔍 STEP 2: SPECIFIC SEGREGATION CARD SEARCH');
console.log('==========================================');

// Look for segregation-specific elements
const segregationCard = document.querySelector('.card.border-info');
if (segregationCard) {
  console.log('✅ Found card with border-info class');
  
  const header = segregationCard.querySelector('.card-header h5');
  if (header) {
    console.log(`📋 Header text: "${header.textContent.trim()}"`);
    
    if (header.textContent.includes('Segregated Clients')) {
      console.log('✅ Found segregated clients card');
      
      // Check card body content
      const cardBody = segregationCard.querySelector('.card-body');
      if (cardBody) {
        const isLoading = !!cardBody.querySelector('.spinner-border');
        const isEmpty = !!cardBody.querySelector('.fa-clipboard-list');
        const hasTable = !!cardBody.querySelector('table');
        const hasRows = cardBody.querySelectorAll('tbody tr').length;
        
        console.log(`📊 Card body analysis:
          - Loading: ${isLoading}
          - Empty state: ${isEmpty}
          - Has table: ${hasTable}
          - Table rows: ${hasRows}`);
        
        if (hasTable && hasRows > 0) {
          console.log('✅ Segregation data is present');
          console.log('📋 First 3 entries:');
          Array.from(cardBody.querySelectorAll('tbody tr')).slice(0, 3).forEach((row, i) => {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
            console.log(`  ${i + 1}. Time: ${cells[0]}, Client: ${cells[1]}, Weight: ${cells[2]}`);
          });
        } else if (isLoading) {
          console.log('⏳ Still loading segregation data...');
        } else if (isEmpty) {
          console.log('📋 No segregated clients today (empty state)');
        } else {
          console.log('❓ Unknown card state');
        }
      }
    } else {
      console.log('❌ Card found but header doesn\'t match');
    }
  } else {
    console.log('❌ No header found in border-info card');
  }
} else {
  console.log('❌ No card with border-info class found');
  
  // Look for any segregation-related text
  const bodyText = document.body.textContent.toLowerCase();
  if (bodyText.includes('segregated')) {
    console.log('🔍 Found "segregated" text in page, but no proper card');
    
    // Search for the text location
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.toLowerCase().includes('segregated clients')) {
        console.log(`📍 Found "segregated clients" text in:`, node.parentElement);
        break;
      }
    }
  } else {
    console.log('❌ No "segregated" text found on page at all');
  }
}

console.log('\n🔍 STEP 3: MANGLE CARD SEGREGATION REFERENCE CHECK');
console.log('==================================================');

// Check if mangle card references segregated weight
const mangleCards = Array.from(allCards).filter(card => {
  const header = card.querySelector('.card-header h5, .card-header .mb-0');
  return header && header.textContent.toLowerCase().includes('mangle');
});

if (mangleCards.length > 0) {
  console.log(`✅ Found ${mangleCards.length} mangle card(s)`);
  mangleCards.forEach((card, i) => {
    const weightElement = card.querySelector('[class*="fa-weight-hanging"]');
    if (weightElement) {
      const weightText = weightElement.parentElement?.textContent || '';
      console.log(`📊 Mangle card ${i + 1} weight display: "${weightText.trim()}"`);
    } else {
      console.log(`❌ Mangle card ${i + 1} has no weight display`);
    }
  });
} else {
  console.log('❌ No mangle cards found');
}

console.log('\n🔍 STEP 4: REACT STATE INSPECTION');
console.log('=================================');

// Try to access React state
try {
  // Look for React root
  const reactRoot = document.querySelector('#root');
  if (reactRoot?._reactInternalInstance) {
    console.log('🔍 React component found, but state inspection requires dev tools');
  } else {
    console.log('📱 React state not directly accessible from console');
  }
  
  // Check if there are any console errors
  console.log('📋 Check browser console for any errors (red text)');
  
} catch (e) {
  console.log('❌ Could not inspect React state:', e.message);
}

console.log('\n🔍 STEP 5: NETWORK REQUESTS CHECK');
console.log('================================');
console.log('📡 Open Network tab and look for:');
console.log('   • Firebase/Firestore requests');
console.log('   • Any failed requests (red)');
console.log('   • Slow requests (yellow/orange)');

console.log('\n🎯 DIAGNOSTIC COMPLETE');
console.log('======================');
console.log('📋 Summary checklist:');
console.log('   □ Are you on the correct page?');
console.log('   □ Is the segregated clients card visible?');
console.log('   □ Is it loading, empty, or has data?');
console.log('   □ Are there any console errors?');
console.log('   □ Are Firebase requests successful?');

console.log('\n💡 Next steps:');
console.log('   1. Check console for errors');
console.log('   2. Check Network tab for failed requests');
console.log('   3. Verify Firebase data exists');
console.log('   4. Check component state in React DevTools');
