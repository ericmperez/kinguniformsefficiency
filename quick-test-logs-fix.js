// Quick Browser Console Test for Production Logs Fix
// Copy and paste this into browser console at http://localhost:5183/production-classification

console.log('🔍 QUICK TEST: Production Logs Fix Status');
console.log('==========================================');

// Wait a moment for the component to load, then check
setTimeout(() => {
  // Check for our debug logs in console (we can't read them, but we set up the component to log)
  console.log('\n📋 CHECKING PRODUCTION LOG TABLES...');
  
  // Find Mangle entries count
  const mangleHeader = Array.from(document.querySelectorAll('h5')).find(h => 
    h.textContent && h.textContent.includes('Mangle Production Log')
  );
  
  if (mangleHeader) {
    const mangleMatch = mangleHeader.textContent.match(/\((\d+) entries\)/);
    const mangleCount = mangleMatch ? parseInt(mangleMatch[1]) : 0;
    console.log(`🟢 Mangle entries: ${mangleCount}`);
    
    if (mangleCount > 0) {
      console.log(`   ✅ ${mangleCount > 50 ? 'HIGH COUNT - Likely showing all entries!' : 'Some entries found'}`);
    }
  } else {
    console.log('❌ Mangle header not found');
  }
  
  // Find Doblado entries count  
  const dobladoHeader = Array.from(document.querySelectorAll('h5')).find(h => 
    h.textContent && h.textContent.includes('Doblado Production Log')
  );
  
  if (dobladoHeader) {
    const dobladoMatch = dobladoHeader.textContent.match(/\((\d+) entries\)/);
    const dobladoCount = dobladoMatch ? parseInt(dobladoMatch[1]) : 0;
    console.log(`🟡 Doblado entries: ${dobladoCount}`);
    
    if (dobladoCount > 0) {
      console.log(`   ✅ ${dobladoCount > 50 ? 'HIGH COUNT - Likely showing all entries!' : 'Some entries found'}`);
    }
  } else {
    console.log('❌ Doblado header not found');
  }
  
  console.log('\n🎯 RESULT:');
  const totalMangleCount = mangleHeader ? (mangleHeader.textContent.match(/\((\d+) entries\)/) || [0, 0])[1] : 0;
  const totalDobladoCount = dobladoHeader ? (dobladoHeader.textContent.match(/\((\d+) entries\)/) || [0, 0])[1] : 0;
  const total = parseInt(totalMangleCount) + parseInt(totalDobladoCount);
  
  if (total > 100) {
    console.log('🎉 SUCCESS! High entry count indicates fix is working!');
  } else if (total > 20) {
    console.log('✅ GOOD! More entries visible than before');
  } else {
    console.log('⚠️ Low entry count - may need to check service data');
  }
  
}, 1000);
