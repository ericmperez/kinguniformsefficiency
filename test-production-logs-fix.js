// Comprehensive Test Script for Production Logs Fix
// This script checks if the Production Classification Dashboard now shows ALL items for today
// Run this in browser console: http://localhost:5183/production-classification

console.clear();
console.log('🧪 PRODUCTION LOGS FIX - COMPREHENSIVE TEST');
console.log('============================================');

function runComprehensiveTest() {
  console.log('\n📊 STEP 1: CHECK CONSOLE LOGS');
  console.log('Looking for our specific log messages...');
  
  // We can't directly inspect console history, but we can check DOM and wait for logs
  console.log('Expected logs:');
  console.log('• 🔍 [Production Logs] Using entries for classification');
  console.log('• 🔍 [Production Logs] Classification results');
  
  console.log('\n📊 STEP 2: CHECK PRODUCTION LOG TABLES');
  
  // Check Mangle Production Log
  const mangleCard = document.querySelector('.card .bg-success');
  if (mangleCard) {
    const mangleText = mangleCard.textContent;
    const mangleMatch = mangleText.match(/\((\d+) entries\)/);
    const mangleCount = mangleMatch ? parseInt(mangleMatch[1]) : 0;
    
    console.log(`🟢 Mangle Production Log: ${mangleCount} entries`);
    
    // Count actual table rows (excluding empty state)
    const mangleTableRows = document.querySelectorAll('.bg-success').length > 0 ? 
      Array.from(document.querySelectorAll('.card')).find(card => 
        card.querySelector('.bg-success')?.textContent?.includes('Mangle Production Log')
      )?.querySelectorAll('tbody tr:not(.text-center)') : [];
    
    console.log(`   └─ Visible table rows: ${mangleTableRows?.length || 0}`);
    
    if (mangleCount > 50) {
      console.log('   ✅ GOOD: More than 50 entries (likely using allEntriesToday)');
    } else if (mangleCount > 0) {
      console.log('   ⚠️  WARNING: Low count, might still be using recentEntries only');
    } else {
      console.log('   ❌ No mangle entries found');
    }
  } else {
    console.log('❌ Mangle production log header not found');
  }
  
  // Check Doblado Production Log
  const dobladoCard = document.querySelector('.card .bg-warning');
  if (dobladoCard) {
    const dobladoText = dobladoCard.textContent;
    const dobladoMatch = dobladoText.match(/\((\d+) entries\)/);
    const dobladoCount = dobladoMatch ? parseInt(dobladoMatch[1]) : 0;
    
    console.log(`🟡 Doblado Production Log: ${dobladoCount} entries`);
    
    // Count actual table rows
    const dobladoTableRows = document.querySelectorAll('.bg-warning').length > 0 ? 
      Array.from(document.querySelectorAll('.card')).find(card => 
        card.querySelector('.bg-warning')?.textContent?.includes('Doblado Production Log')
      )?.querySelectorAll('tbody tr:not(.text-center)') : [];
    
    console.log(`   └─ Visible table rows: ${dobladoTableRows?.length || 0}`);
    
    if (dobladoCount > 50) {
      console.log('   ✅ GOOD: More than 50 entries (likely using allEntriesToday)');
    } else if (dobladoCount > 0) {
      console.log('   ⚠️  WARNING: Low count, might still be using recentEntries only');
    } else {
      console.log('   ❌ No doblado entries found');
    }
  } else {
    console.log('❌ Doblado production log header not found');
  }
  
  console.log('\n📊 STEP 3: CHECK TIME RANGE');
  
  // Look for early time entries to confirm we're seeing all items
  const timeElements = document.querySelectorAll('.badge.bg-success, .badge.bg-warning');
  const times = [];
  
  timeElements.forEach(badge => {
    const timeText = badge.textContent?.match(/\d{1,2}:\d{2}/);
    if (timeText) {
      times.push(timeText[0]);
    }
  });
  
  if (times.length > 0) {
    times.sort();
    console.log(`⏰ Time range in production logs: ${times[0]} to ${times[times.length - 1]}`);
    
    // Check if we have early entries
    const earliestHour = parseInt(times[0].split(':')[0]);
    if (earliestHour < 10) {
      console.log('   ✅ EXCELLENT: Found entries from early morning');
    } else if (earliestHour < 13) {
      console.log('   ✅ GOOD: Found entries before 13:00');
    } else {
      console.log('   ⚠️  WARNING: Earliest entry is after 13:00');
    }
  } else {
    console.log('   ❌ No time entries found in production logs');
  }
  
  console.log('\n📊 STEP 4: SUMMARY');
  
  const totalMangleCount = mangleCard ? (mangleCard.textContent.match(/\((\d+) entries\)/) || [0, 0])[1] : 0;
  const totalDobladoCount = dobladoCard ? (dobladoCard.textContent.match(/\((\d+) entries\)/) || [0, 0])[1] : 0;
  const totalEntries = parseInt(totalMangleCount) + parseInt(totalDobladoCount);
  
  console.log(`📈 Total entries in production logs: ${totalEntries}`);
  
  if (totalEntries > 100) {
    console.log('🎉 SUCCESS: High entry count suggests we\'re now showing ALL items for today!');
  } else if (totalEntries > 50) {
    console.log('✅ IMPROVEMENT: More entries than before, likely working correctly');
  } else if (totalEntries > 0) {
    console.log('⚠️  PARTIAL: Some entries found but count is low');
  } else {
    console.log('❌ FAILED: No entries found in production logs');
  }
  
  console.log('\n🎯 NEXT STEPS:');
  if (totalEntries > 50) {
    console.log('• Test by scrolling through the production log tables');
    console.log('• Verify you can see items from earlier in the day');
    console.log('• Check if classification (Mangle vs Doblado) looks correct');
  } else {
    console.log('• Check browser console for our debug logs');
    console.log('• Verify ProductionTrackingService is providing allEntriesToday');
    console.log('• Refresh the page and run test again');
  }
}

// Run test immediately
runComprehensiveTest();

// Also make it available as a function to re-run
window.testProductionLogsFix = runComprehensiveTest;

console.log('\n💡 TIP: Run window.testProductionLogsFix() to re-run this test anytime');
