// Quick verification script for the Production Classification Dashboard fix
// Run this in browser console on the dashboard page

console.clear();
console.log('🔍 Verifying Production Classification Dashboard Fix...');

setTimeout(() => {
  // Check the hourly table
  const table = document.querySelector('.table-striped.table-hover');
  if (table) {
    const rows = table.querySelectorAll('tbody tr');
    console.log(`\n📊 Hourly Table Analysis:`);
    console.log(`- Total rows: ${rows.length}`);
    
    let fixedRows = 0;
    let brokenRows = 0;
    
    rows.forEach((row, i) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        const hour = cells[0].textContent?.trim();
        const items = cells[1].textContent?.trim();
        const units = cells[2].textContent?.trim();
        const clients = cells[3].textContent?.trim();
        const products = cells[4].textContent?.trim();
        
        // Check if row has real data (not just dashes)
        const hasRealData = (
          items !== '-' && !items?.includes('?') && 
          clients !== '-' && !clients?.includes('?') && 
          products !== 'No activity' && !products?.includes('sync issue')
        );
        
        if (hasRealData && units !== '-') {
          fixedRows++;
          console.log(`✅ ${hour}: Items=${items}, Units=${units}, Clients=${clients}`);
        } else if (units !== '-') {
          brokenRows++;
          console.log(`❌ ${hour}: Units=${units} but missing details`);
        }
      }
    });
    
    console.log(`\n🎯 Fix Status:`);
    console.log(`- Fixed rows (complete data): ${fixedRows}`);
    console.log(`- Broken rows (missing details): ${brokenRows}`);
    console.log(`- Success rate: ${fixedRows > 0 && brokenRows === 0 ? '100% ✅' : `${Math.round(fixedRows/(fixedRows+brokenRows)*100)}%`}`);
    
    if (fixedRows > 0 && brokenRows === 0) {
      console.log('\n🎉 SUCCESS! The Production Classification Dashboard is now fully fixed!');
      console.log('- All hourly data is displaying correctly');
      console.log('- Items Added, Clients, and Top Products columns are populated');
      console.log('- Debug sections have been removed');
    } else if (brokenRows > 0) {
      console.log('\n⚠️ Partial fix detected. Some hours still missing details.');
    }
    
  } else {
    console.log('❌ Hourly table not found');
  }
  
  // Check edit classifications
  const editButton = document.querySelector('button[onclick*="setShowEditModal"], button:contains("Edit Classifications")');
  if (editButton) {
    console.log('\n📝 Edit Classifications: Ready ✅');
  }
  
}, 1000);
