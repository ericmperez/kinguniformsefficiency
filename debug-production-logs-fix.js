// Debug script to check if Production Logs are now showing ALL items
// Run this in browser console on the Production Classification Dashboard

console.clear();
console.log('🔍 PRODUCTION LOGS FIX - DEBUG CHECK');
console.log('=====================================');

setTimeout(() => {
  // Check console logs first
  console.log('\n📊 EXPECTED CONSOLE LOGS:');
  console.log('Look for these log messages from our fix:');
  console.log('1. "🔍 [Production Logs] Using entries for classification"');
  console.log('2. "🔍 [Production Logs] Classification results"');
  console.log('   - Should show total entries, mangle entries, doblado entries');
  console.log('   - Should show higher counts if using allEntriesToday');

  // Check the production log tables
  const mangleTable = document.querySelector('.card-header.bg-success');
  const dobladoTable = document.querySelector('.card-header.bg-warning');
  
  if (mangleTable) {
    const mangleCount = mangleTable.textContent.match(/\((\d+) entries\)/);
    console.log(`\n🟢 MANGLE LOG: ${mangleCount ? mangleCount[1] : 'Count not found'} entries`);
    
    // Count rows in mangle table
    const mangleRows = document.querySelectorAll('.card-header.bg-success + .card-body tbody tr:not(.text-center)');
    console.log(`   └─ Visible rows: ${mangleRows.length}`);
  } else {
    console.log('\n❌ Mangle table header not found');
  }
  
  if (dobladoTable) {
    const dobladoCount = dobladoTable.textContent.match(/\((\d+) entries\)/);
    console.log(`\n🟡 DOBLADO LOG: ${dobladoCount ? dobladoCount[1] : 'Count not found'} entries`);
    
    // Count rows in doblado table  
    const dobladoRows = document.querySelectorAll('.card-header.bg-warning + .card-body tbody tr:not(.text-center)');
    console.log(`   └─ Visible rows: ${dobladoRows.length}`);
  } else {
    console.log('\n❌ Doblado table header not found');
  }

  // Look for any empty state messages
  const emptyMangle = document.querySelector('.card-body:contains("No mangle items")');
  const emptyDoblado = document.querySelector('.card-body:contains("No doblado items")');
  
  if (emptyMangle) {
    console.log('\n⚠️  Mangle table shows "No items" - check if classification is working');
  }
  if (emptyDoblado) {
    console.log('\n⚠️  Doblado table shows "No items" - check if classification is working');
  }

  console.log('\n🎯 SUCCESS INDICATORS:');
  console.log('✅ Entry counts should be higher than before (more than ~50)');
  console.log('✅ Tables should show items from earlier in the day');  
  console.log('✅ Console logs should show "usingAllEntries: true"');
  
  console.log('\n🔧 If still showing limited entries:');
  console.log('• Check if allEntriesToday is being populated correctly');
  console.log('• Verify ProductionTrackingService is providing complete data');
  
}, 2000);
