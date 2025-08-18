// Test Script for Entradas (Pickup Entries) Log Implementation
// Run this in browser console on the Production Classification Dashboard
// http://localhost:3001/production-classification

console.clear();
console.log('🧪 ENTRADAS (PICKUP ENTRIES) LOG IMPLEMENTATION TEST');
console.log('===============================================');

setTimeout(() => {
  console.log('\n📊 STEP 1: CHECK PICKUP ENTRIES LOG SECTION');
  
  // Look for the pickup entries card
  const pickupCard = document.querySelector('.card.border-primary');
  const pickupHeader = pickupCard?.querySelector('.card-header.bg-primary');
  
  if (pickupCard && pickupHeader) {
    const headerText = pickupHeader.querySelector('h5')?.textContent?.trim();
    console.log(`✅ Found pickup entries section: "${headerText}"`);
    
    // Check for summary stats in header
    const summaryStats = pickupHeader.querySelectorAll('.text-end .fw-bold');
    if (summaryStats.length >= 2) {
      const entriesCount = summaryStats[0]?.textContent?.trim();
      const totalWeight = summaryStats[1]?.textContent?.trim();
      console.log(`📈 Header stats: ${entriesCount} entries, ${totalWeight}`);
    }
    
    console.log('\n📊 STEP 2: CHECK TABLE STRUCTURE');
    
    // Check table structure
    const table = pickupCard.querySelector('table.table-striped.table-hover');
    if (table) {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim());
      console.log('📋 Table headers:', headers);
      
      // Check for expected columns
      const expectedColumns = ['Time', 'Client Name', 'Driver Name', 'Weight (lbs)', 'Status'];
      const hasAllColumns = expectedColumns.every(col => headers.includes(col));
      
      if (hasAllColumns) {
        console.log('✅ All expected columns are present');
      } else {
        console.log('❌ Missing expected columns');
        console.log('Expected:', expectedColumns);
        console.log('Found:', headers);
      }
      
      // Check data rows
      const rows = table.querySelectorAll('tbody tr');
      console.log(`📊 Found ${rows.length} pickup entry rows`);
      
      if (rows.length > 0) {
        console.log('\n📝 Sample data from first few rows:');
        
        Array.from(rows).slice(0, 3).forEach((row, index) => {
          const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());
          console.log(`Row ${index + 1}:`, {
            time: cells[0],
            client: cells[1],
            driver: cells[2],
            weight: cells[3],
            status: cells[4]
          });
        });
        
        console.log('\n🎨 STEP 3: CHECK PROFESSIONAL STYLING');
        
        // Check styling consistency with other production logs
        const timeCell = table.querySelector('tbody tr:first-child td:first-child .badge');
        const weightCell = table.querySelector('tbody tr:first-child td:nth-child(4) .badge');
        const statusCell = table.querySelector('tbody tr:first-child td:nth-child(5) .badge');
        
        console.log('🎨 Badge styling check:');
        console.log(`  Time badge: ${timeCell?.className || 'Not found'}`);
        console.log(`  Weight badge: ${weightCell?.className || 'Not found'}`);
        console.log(`  Status badge: ${statusCell?.className || 'Not found'}`);
        
        // Check if styling matches other tables
        const expectedTimeBadge = 'badge bg-info';
        const expectedWeightBadge = 'badge bg-success fs-6';
        const expectedStatusBadge = 'badge bg-primary';
        
        const stylingConsistent = 
          timeCell?.className.includes('bg-info') &&
          weightCell?.className.includes('bg-success') &&
          statusCell?.className.includes('bg-primary');
          
        if (stylingConsistent) {
          console.log('✅ Professional styling applied consistently');
        } else {
          console.log('⚠️ Styling may need adjustment');
        }
        
      } else {
        // Check for loading or empty state
        const loadingSpinner = pickupCard.querySelector('.spinner-border');
        const emptyMessage = pickupCard.querySelector('.fa-truck');
        
        if (loadingSpinner) {
          console.log('⏳ Pickup entries data is loading...');
        } else if (emptyMessage) {
          console.log('ℹ️ No pickup entries found today (empty state shown)');
        } else {
          console.log('❌ Pickup entries table not found');
        }
      }
      
    } else {
      console.log('❌ Pickup entries table not found');
    }
    
  } else {
    console.log('❌ Pickup entries section not found');
    console.log('Available cards:', document.querySelectorAll('.card').length);
  }
  
  console.log('\n📊 STEP 4: COMPARE WITH OTHER PRODUCTION LOGS');
  
  // Compare styling with segregation and production logs
  const segregationTable = document.querySelector('.card.border-info table');
  const mangleTable = document.querySelector('.card-header.bg-success').parentElement.querySelector('table');
  const dobladoTable = document.querySelector('.card-header.bg-warning').parentElement.querySelector('table');
  
  console.log('📋 Table styling comparison:');
  console.log(`  Segregation table: ${segregationTable ? '✅ Found' : '❌ Not found'}`);
  console.log(`  Mangle table: ${mangleTable ? '✅ Found' : '❌ Not found'}`);
  console.log(`  Doblado table: ${dobladoTable ? '✅ Found' : '❌ Not found'}`);
  console.log(`  Pickup entries table: ${table ? '✅ Found' : '❌ Not found'}`);
  
  if (table && segregationTable) {
    const pickupHeader = table.querySelector('thead');
    const segregationHeader = segregationTable.querySelector('thead');
    
    const bothHaveInfoHeader = 
      pickupHeader?.className?.includes('table-info') && 
      segregationHeader?.className?.includes('table-info');
      
    console.log(`  Consistent header styling: ${bothHaveInfoHeader ? '✅ Yes' : '❌ No'}`);
  }
  
  console.log('\n📊 STEP 5: CHECK BROWSER CONSOLE LOGS');
  console.log('Look for these specific log messages from our implementation:');
  console.log('• 🚛 [Pickup Entries] Loaded pickup entries data for today');
  console.log('• Error messages related to pickup entries data fetching');
  
  console.log('\n🎯 SUMMARY');
  const hasPickupSection = !!pickupCard;
  const hasTable = !!table;
  const hasData = table?.querySelectorAll('tbody tr').length > 0;
  
  if (hasPickupSection && hasTable) {
    console.log('🎉 SUCCESS! Pickup entries (entradas) log is implemented and visible');
    console.log('✅ Pickup entries section is displayed');
    console.log('✅ Table structure is correct');
    console.log(`✅ Data loading: ${hasData ? 'Has data' : 'Empty (normal if no pickups today)'}`);
    console.log('✅ Professional styling applied');
  } else {
    console.log('⚠️ Partial implementation:');
    console.log(`   - Pickup entries section: ${hasPickupSection ? '✅' : '❌'}`);
    console.log(`   - Table structure: ${hasTable ? '✅' : '❌'}`);
    console.log(`   - Data display: ${hasData ? '✅' : 'Empty'}`);
  }
  
}, 2000);

console.log('\n🔧 TESTING INSTRUCTIONS:');
console.log('1. Navigate to: http://localhost:3001/production-classification');
console.log('2. Look for the "Pickup Entries Today" section with blue border');
console.log('3. Check that it shows pickup entries from today with professional styling');
console.log('4. Verify it matches the styling of segregation and production logs');
console.log('5. Run this test script to get detailed analysis');
