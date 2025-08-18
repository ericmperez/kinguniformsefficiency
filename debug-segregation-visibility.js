// Debug script to check segregation information visibility
// Run this in browser console on the Production Classification Dashboard

console.clear();
console.log('🔍 SEGREGATION INFORMATION DEBUG');
console.log('=================================');

setTimeout(() => {
  console.log('\n📊 STEP 1: CHECK SEGREGATION LOG SECTION');
  
  // Look for the segregated clients card
  const segregationCard = document.querySelector('.card.border-info');
  const segregationHeader = segregationCard?.querySelector('.card-header.bg-info');
  
  if (segregationCard && segregationHeader) {
    const headerText = segregationHeader.querySelector('h5')?.textContent?.trim();
    console.log(`✅ Found segregation section: "${headerText}"`);
    
    // Check for summary stats in header
    const summaryStats = segregationHeader.querySelectorAll('.text-end .fw-bold');
    if (summaryStats.length >= 2) {
      const clientsCount = summaryStats[0]?.textContent?.trim();
      const totalWeight = summaryStats[1]?.textContent?.trim();
      console.log(`📈 Header stats: ${clientsCount} clients, ${totalWeight}`);
    } else {
      console.log('⚠️ Header stats not found or incomplete');
      console.log('Available header elements:', segregationHeader.innerHTML);
    }
    
    // Check table content
    const table = segregationCard.querySelector('table');
    if (table) {
      const rows = table.querySelectorAll('tbody tr');
      console.log(`📊 Table rows found: ${rows.length}`);
      
      if (rows.length > 0) {
        console.log('✅ Segregation data is present');
        // Show first few entries
        Array.from(rows).slice(0, 3).forEach((row, index) => {
          const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());
          console.log(`  Row ${index + 1}:`, {
            time: cells[0],
            client: cells[1],
            weight: cells[2],
            user: cells[3],
            status: cells[4]
          });
        });
      } else {
        // Check for loading or empty state
        const loadingSpinner = segregationCard.querySelector('.spinner-border');
        const emptyMessage = segregationCard.querySelector('.fa-clipboard-list');
        
        if (loadingSpinner) {
          console.log('⏳ Segregation data is still loading...');
        } else if (emptyMessage) {
          console.log('ℹ️ No segregated clients found today (empty state)');
        } else {
          console.log('❌ Unknown table state');
        }
      }
    } else {
      console.log('❌ Segregation table not found in card');
    }
    
  } else {
    console.log('❌ Segregation section not found');
    console.log('Available cards:', document.querySelectorAll('.card').length);
    
    // List all available cards
    document.querySelectorAll('.card').forEach((card, index) => {
      const header = card.querySelector('.card-header h5');
      const headerText = header?.textContent?.trim() || 'No header';
      console.log(`  Card ${index + 1}: ${headerText}`);
    });
  }
  
  console.log('\n📊 STEP 2: CHECK MANGLE CARD SEGREGATED WEIGHT');
  
  // Look for segregated weight in mangle card
  const mangleCard = document.querySelector('.card.border-success .card-header.bg-success');
  if (mangleCard) {
    const weightElement = mangleCard.querySelector('[class*="fas fa-weight-hanging"]');
    if (weightElement) {
      const weightText = weightElement.parentElement?.textContent || '';
      console.log(`✅ Found segregated weight in mangle card: "${weightText}"`);
    } else {
      console.log('❌ Segregated weight not found in mangle card');
    }
  } else {
    console.log('❌ Mangle card not found');
  }
  
  console.log('\n📊 STEP 3: CHECK BROWSER CONSOLE FOR ERRORS');
  console.log('Look for these specific error messages:');
  console.log('• Error fetching segregation data');
  console.log('• Firebase connection issues');
  console.log('• 🏭 [Segregation Data] log messages');
  
  console.log('\n📊 STEP 4: CHECK REACT STATE');
  
  // Try to access React component state if possible
  try {
    const reactRoot = document.querySelector('#root');
    if (reactRoot && reactRoot._reactInternalInstance) {
      console.log('📱 React component found - checking state...');
    } else {
      console.log('📱 React component state not directly accessible');
    }
  } catch (e) {
    console.log('📱 Could not access React state:', e.message);
  }
  
  console.log('\n🎯 SUMMARY');
  const hasSegregationCard = !!segregationCard;
  const hasSegregationData = segregationCard?.querySelectorAll('tbody tr').length > 0;
  const hasMangleWeight = !!mangleCard?.querySelector('[class*="fas fa-weight-hanging"]');
  
  if (!hasSegregationCard) {
    console.log('❌ ISSUE: Segregation card is missing completely');
    console.log('🔧 Check if the component is rendering properly');
  } else if (!hasSegregationData && !segregationCard.querySelector('.spinner-border')) {
    console.log('❌ ISSUE: Segregation card exists but shows no data and no loading state');
    console.log('🔧 Check segregation data fetching and Firebase connection');
  } else if (!hasMangleWeight) {
    console.log('❌ ISSUE: Segregated weight missing from mangle card');
    console.log('🔧 Check segregated weight display logic');
  } else {
    console.log('✅ Segregation information appears to be working correctly');
  }
  
}, 2000);
