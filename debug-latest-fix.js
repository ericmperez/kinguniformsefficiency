// Check latest console output for Production Classification Dashboard
// Run this in browser console to see if the Mangle/Doblado split is working

console.clear();
console.log('🔍 Checking Production Classification Dashboard - Mangle/Doblado Split...');

// Look for our specific log messages
console.log('Look for these key logs:');
console.log('1. "🔍 [Hourly Table] Data availability" - shows if using allEntriesToday');
console.log('2. "🔍 [Hourly Table] Processed hourly data" - shows hourly stats with mangle/doblado breakdown');
console.log('3. "mangleUnits" and "dobladoUnits" - confirms classification tracking is active');

// Check DOM for current table state
setTimeout(() => {
  const table = document.querySelector('.table-striped.table-hover');
  if (table) {
    const rows = table.querySelectorAll('tbody tr');
    console.log(`\nTable Analysis: ${rows.length} rows found`);
    
    let hasMangeDobladoData = false;
    let hasClientsData = false;
    let hasProductsData = false;
    
    rows.forEach((row, i) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        const hour = cells[0].textContent?.trim();
        const mangleDoblado = cells[1].textContent?.trim();
        const units = cells[2].textContent?.trim();
        const clients = cells[3].textContent?.trim();
        const products = cells[4].textContent?.trim();
        
        if (mangleDoblado !== '-' && !mangleDoblado.includes('?') && (mangleDoblado.includes('M') || mangleDoblado.includes('D'))) hasMangeDobladoData = true;
        if (clients !== '-' && !clients.includes('?')) hasClientsData = true;
        if (products !== 'No activity' && !products.includes('sync issue')) hasProductsData = true;
        
        console.log(`${hour}: M/D Split=${mangleDoblado?.replace(/\n/g, ' ')}, Units=${units}, Clients=${clients}, Products=${products?.substring(0,30)}...`);
      }
    });
    
    console.log(`\nFix Status:`);
    console.log(`- Mangle/Doblado Split column: ${hasMangeDobladoData ? '✅ WORKING' : '❌ Not working'}`);
    console.log(`- Clients column: ${hasClientsData ? '✅ FIXED' : '❌ Still broken'}`);
    console.log(`- Top Products column: ${hasProductsData ? '✅ FIXED' : '❌ Still broken'}`);
    
    // Look for percentage badges
    const badges = document.querySelectorAll('.badge.bg-success, .badge.bg-warning');
    console.log(`\nBadge Analysis: Found ${badges.length} classification badges`);
    badges.forEach((badge, i) => {
      console.log(`Badge ${i}: ${badge.textContent} (${badge.classList.contains('bg-success') ? 'Mangle' : 'Doblado'})`);
    });
    
  } else {
    console.log('❌ Table not found');
  }
}, 1000);
