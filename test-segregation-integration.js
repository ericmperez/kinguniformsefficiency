// Test Script for Segregation Data Integration
// Run this in browser console on the Production Classification Dashboard
// http://localhost:5183/production-classification

console.clear();
console.log('🧪 SEGREGATION DATA INTEGRATION TEST');
console.log('=====================================');

setTimeout(() => {
  console.log('\n📊 STEP 1: CHECK MANGLE PRODUCTION CARD');
  
  // Check if the segregated weight is displayed in Mangle card
  const mangleCard = document.querySelector('.card.border-success .card-header.bg-success');
  if (mangleCard) {
    const weightElement = mangleCard.querySelector('[class*="fas fa-weight-hanging"]');
    if (weightElement) {
      const weightText = weightElement.parentElement?.textContent || '';
      console.log(`✅ Found segregated weight display: "${weightText}"`);
      
      // Check for loading spinner or actual weight
      const hasSpinner = mangleCard.querySelector('.spinner-border-sm');
      if (hasSpinner) {
        console.log('⏳ Weight data is still loading...');
      } else {
        const weightMatch = weightText.match(/(\d+(?:,\d+)*)\s*lbs/);
        if (weightMatch) {
          console.log(`✅ Segregated weight found: ${weightMatch[1]} lbs`);
        } else {
          console.log('⚠️  Weight format not recognized');
        }
      }
    } else {
      console.log('❌ Segregated weight display not found in Mangle card');
    }
  } else {
    console.log('❌ Mangle production card not found');
  }

  console.log('\n📊 STEP 2: CHECK SEGREGATED CLIENTS LOG');
  
  // Check for the segregated clients log section
  const segregatedSection = document.querySelector('.card.border-info');
  if (segregatedSection) {
    const headerText = segregatedSection.querySelector('.card-header h5')?.textContent;
    console.log(`✅ Found segregated clients section: "${headerText}"`);
    
    // Check for summary stats in header
    const summaryStats = segregatedSection.querySelectorAll('.card-header .text-end .fw-bold');
    if (summaryStats.length >= 2) {
      const clientCount = summaryStats[0]?.textContent || '';
      const totalWeight = summaryStats[1]?.textContent || '';
      console.log(`✅ Summary stats found: ${clientCount}, ${totalWeight}`);
    }
    
    // Check for table data
    const table = segregatedSection.querySelector('table');
    if (table) {
      const rows = table.querySelectorAll('tbody tr');
      console.log(`✅ Found segregated clients table with ${rows.length} rows`);
      
      if (rows.length > 0) {
        console.log('📋 Sample client entries:');
        Array.from(rows).slice(0, 3).forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const clientName = cells[0]?.textContent?.trim() || 'Unknown';
            const weight = cells[1]?.textContent?.trim() || '0';
            const time = cells[2]?.textContent?.trim() || 'Unknown';
            console.log(`  ${index + 1}. ${clientName} - ${weight} at ${time}`);
          }
        });
      } else {
        console.log('ℹ️  No segregated clients found for today');
      }
    } else {
      // Check for loading or empty state
      const loadingSpinner = segregatedSection.querySelector('.spinner-border');
      const emptyMessage = segregatedSection.querySelector('.fa-clipboard-list');
      
      if (loadingSpinner) {
        console.log('⏳ Segregated clients data is loading...');
      } else if (emptyMessage) {
        console.log('ℹ️  No segregated clients found today (empty state shown)');
      } else {
        console.log('❌ Segregated clients table not found');
      }
    }
  } else {
    console.log('❌ Segregated clients log section not found');
  }

  console.log('\n📊 STEP 3: CHECK BROWSER CONSOLE LOGS');
  console.log('Look for these specific log messages from our integration:');
  console.log('• 🏭 [Segregation Data] Loaded segregation data for today');
  console.log('• Error messages related to segregation data fetching');

  console.log('\n🎯 SUMMARY');
  const mangleHasWeight = !!document.querySelector('.card.border-success [class*="fas fa-weight-hanging"]');
  const hasSegregatedSection = !!document.querySelector('.card.border-info h5:contains("Segregated Clients Today")');
  
  if (mangleHasWeight && hasSegregatedSection) {
    console.log('🎉 SUCCESS! Both segregation features are implemented and visible');
    console.log('✅ Mangle card shows segregated weight');
    console.log('✅ Segregated clients log is displayed');
  } else {
    console.log('⚠️  Partial implementation:');
    console.log(`   - Mangle weight display: ${mangleHasWeight ? '✅' : '❌'}`);
    console.log(`   - Segregated clients log: ${hasSegregatedSection ? '✅' : '❌'}`);
  }
  
  console.log('\n💡 NEXT STEPS:');
  console.log('1. Check that segregation data is being fetched properly');
  console.log('2. Verify segregation_done_logs collection has today\'s data');
  console.log('3. Test with actual segregated clients to see real data');

}, 2000);

// Make test available for re-running
window.testSegregationIntegration = function() {
  location.reload();
  setTimeout(arguments.callee, 2000);
};

console.log('\n💡 TIP: Run window.testSegregationIntegration() to re-run this test');
