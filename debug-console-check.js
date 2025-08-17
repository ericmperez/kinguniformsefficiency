// Production Classification Dashboard Console Debug Instructions
// Open the browser to http://localhost:5183/production-classification
// Then open Developer Tools (F12) and run this in the console

console.clear();
console.log('🔍 Starting Production Classification Dashboard Debug');

// Wait for the component to load and look for console logs
setTimeout(() => {
  console.log('🔍 Checking for recent logs...');
  
  // Look for specific log patterns we added
  const logs = [
    '🔍 [Hourly Table] Building table with:',
    '🔍 [Hourly Table] Processed hourly data:',
    '🔍 [Hourly Table] All hours found:',
    '🔍 [Hourly Table] Hour'
  ];
  
  console.log('If you see logs starting with 🔍 [Hourly Table], the component is working');
  console.log('If not, there might be an issue with data loading or component rendering');
  
  // Check DOM elements
  const table = document.querySelector('.table-striped.table-hover');
  if (table) {
    const rows = table.querySelectorAll('tbody tr');
    console.log(`✅ Found table with ${rows.length} rows`);
    
    if (rows.length === 0) {
      console.log('❌ No table rows found - this might be the issue');
    } else {
      console.log('✅ Table has rows, checking content...');
      Array.from(rows).slice(0, 3).forEach((row, i) => {
        const cells = row.querySelectorAll('td');
        console.log(`Row ${i}:`, Array.from(cells).map(cell => cell.textContent?.trim()));
      });
    }
  } else {
    console.log('❌ Table not found');
  }
  
}, 2000);
