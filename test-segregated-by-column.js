// Test script to verify "Segregated By" column is working in Production Classification Dashboard
// Run this in browser console on the Reports -> Production Classification page

console.clear();
console.log('🔍 Testing "Segregated By" Column in Segregation Logs...');

// Wait for page to load
setTimeout(() => {
  console.log('\n📊 Checking segregation logs table structure...');
  
  // Find the segregation logs table
  const tables = document.querySelectorAll('table.table-striped');
  let segregationTable = null;
  
  tables.forEach(table => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
    if (headers.includes('Segregated By')) {
      segregationTable = table;
    }
  });
  
  if (segregationTable) {
    console.log('✅ Found segregation table with "Segregated By" column');
    
    // Check headers
    const headers = Array.from(segregationTable.querySelectorAll('th')).map(th => th.textContent?.trim());
    console.log('📋 Table headers:', headers);
    
    // Check for expected columns
    const expectedColumns = ['Time', 'Client Name', 'Weight (lbs)', 'Segregated By', 'Status'];
    const hasAllColumns = expectedColumns.every(col => headers.includes(col));
    
    if (hasAllColumns) {
      console.log('✅ All expected columns are present');
    } else {
      console.log('❌ Missing expected columns');
      console.log('Expected:', expectedColumns);
      console.log('Found:', headers);
    }
    
    // Check data rows
    const rows = segregationTable.querySelectorAll('tbody tr');
    console.log(`📊 Found ${rows.length} data rows`);
    
    if (rows.length > 0) {
      console.log('\n📝 Sample data from first few rows:');
      
      Array.from(rows).slice(0, 3).forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());
        console.log(`Row ${index + 1}:`, {
          time: cells[0],
          client: cells[1],
          weight: cells[2],
          segregatedBy: cells[3],
          status: cells[4]
        });
      });
      
      // Check if "Segregated By" column has actual user data
      const segregatedByColumn = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        return cells[3]?.textContent?.trim();
      });
      
      const hasUserData = segregatedByColumn.some(user => user && user !== 'Unknown');
      
      if (hasUserData) {
        console.log('✅ "Segregated By" column contains actual user data');
        
        // Show unique users
        const uniqueUsers = [...new Set(segregatedByColumn.filter(user => user && user !== 'Unknown'))];
        console.log('👥 Users who performed segregation:', uniqueUsers);
      } else {
        console.log('⚠️ "Segregated By" column shows only "Unknown" - this may be expected if no recent segregation has been done');
      }
    } else {
      console.log('ℹ️ No segregation data for today - table is empty (this is normal if no segregation has been performed today)');
    }
    
  } else {
    console.log('❌ Could not find segregation table with "Segregated By" column');
    console.log('Available tables:', tables.length);
    
    tables.forEach((table, index) => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
      console.log(`Table ${index + 1} headers:`, headers);
    });
  }
  
  console.log('\n✨ Test completed! Navigate to Reports → Production Classification to see the segregation logs.');
  
}, 2000);
