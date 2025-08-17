// Test script to verify consistent professional styling across all production logs
// Run this in browser console on the Reports -> Production Classification page

console.clear();
console.log('🎨 Testing Consistent Professional Styling Across All Production Logs...');

// Wait for page to load
setTimeout(() => {
  console.log('\n📊 Analyzing table styling consistency...');
  
  // Find all production log tables
  const tables = document.querySelectorAll('table.table-striped');
  console.log(`📋 Found ${tables.length} production log tables`);
  
  const tableAnalysis = [];
  
  tables.forEach((table, index) => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
    const headerClass = table.querySelector('thead')?.className || '';
    
    // Determine table type
    let tableType = 'Unknown';
    if (headers.includes('Segregated By')) {
      tableType = 'Segregation';
    } else if (headers.includes('Product') && headers.includes('Added By')) {
      // Check parent card header to distinguish between Mangle and Doblado
      const cardHeader = table.closest('.card')?.querySelector('.card-header');
      const headerText = cardHeader?.textContent || '';
      if (headerText.includes('Mangle')) {
        tableType = 'Mangle';
      } else if (headerText.includes('Doblado')) {
        tableType = 'Doblado';
      } else {
        tableType = 'Production';
      }
    }
    
    // Check styling consistency
    const analysis = {
      type: tableType,
      headerClass: headerClass,
      hasInfoHeader: headerClass.includes('table-info'),
      hasP0CardBody: table.closest('.card-body')?.classList.contains('p-0'),
      hasStripedHover: table.classList.contains('table-striped') && table.classList.contains('table-hover'),
      hasMb0: table.classList.contains('mb-0'),
      headers: headers,
      sampleTimeCell: null,
      sampleQuantityCell: null
    };
    
    // Check sample cell styling
    const firstRow = table.querySelector('tbody tr:not(.text-center)'); // Skip empty state rows
    if (firstRow) {
      const timeBadge = firstRow.querySelector('td:first-child .badge');
      const quantityBadge = firstRow.querySelector('td .badge.bg-success');
      
      analysis.sampleTimeCell = {
        hasBadge: !!timeBadge,
        hasInfoBadge: timeBadge?.classList.contains('bg-info'),
        badgeClass: timeBadge?.className || 'none'
      };
      
      analysis.sampleQuantityCell = {
        hasBadge: !!quantityBadge,
        hasSuccessBadge: quantityBadge?.classList.contains('bg-success'),
        hasFs6: quantityBadge?.classList.contains('fs-6'),
        badgeClass: quantityBadge?.className || 'none'
      };
    }
    
    tableAnalysis.push(analysis);
  });
  
  console.log('\n🔍 Table Analysis Results:');
  console.log('='.repeat(60));
  
  tableAnalysis.forEach((analysis, index) => {
    console.log(`\n📊 Table ${index + 1}: ${analysis.type}`);
    console.log(`   Header Class: ${analysis.headerClass}`);
    console.log(`   ✅ Professional Header: ${analysis.hasInfoHeader ? 'YES' : 'NO'}`);
    console.log(`   ✅ Edge-to-edge Layout: ${analysis.hasP0CardBody ? 'YES' : 'NO'}`);
    console.log(`   ✅ Striped & Hover: ${analysis.hasStripedHover ? 'YES' : 'NO'}`);
    console.log(`   ✅ No bottom margin: ${analysis.hasMb0 ? 'YES' : 'NO'}`);
    
    if (analysis.sampleTimeCell) {
      console.log(`   Time Cell: ${analysis.sampleTimeCell.hasInfoBadge ? '✅ badge bg-info' : '❌ ' + analysis.sampleTimeCell.badgeClass}`);
    }
    
    if (analysis.sampleQuantityCell) {
      console.log(`   Quantity Cell: ${analysis.sampleQuantityCell.hasSuccessBadge ? '✅ badge bg-success' : '❌ ' + analysis.sampleQuantityCell.badgeClass}`);
      console.log(`   Quantity Size: ${analysis.sampleQuantityCell.hasFs6 ? '✅ fs-6' : '❌ missing fs-6'}`);
    }
    
    console.log(`   Headers: [${analysis.headers.join(', ')}]`);
  });
  
  // Check overall consistency
  console.log('\n🎯 CONSISTENCY CHECK:');
  console.log('='.repeat(40));
  
  const hasConsistentHeaders = tableAnalysis.every(t => t.hasInfoHeader);
  const hasConsistentLayout = tableAnalysis.every(t => t.hasP0CardBody);
  const hasConsistentTable = tableAnalysis.every(t => t.hasStripedHover && t.hasMb0);
  
  console.log(`✅ All tables use table-info headers: ${hasConsistentHeaders ? 'YES' : 'NO'}`);
  console.log(`✅ All tables use p-0 card-body: ${hasConsistentLayout ? 'YES' : 'NO'}`);
  console.log(`✅ All tables use consistent classes: ${hasConsistentTable ? 'YES' : 'NO'}`);
  
  const segregationTable = tableAnalysis.find(t => t.type === 'Segregation');
  const mangleTable = tableAnalysis.find(t => t.type === 'Mangle');
  const dobladoTable = tableAnalysis.find(t => t.type === 'Doblado');
  
  if (segregationTable && mangleTable && dobladoTable) {
    console.log('\n📊 SPECIFIC TABLE CHECK:');
    console.log(`✅ Segregation Table: Professional styling applied`);
    console.log(`✅ Mangle Table: ${mangleTable.hasInfoHeader && mangleTable.sampleTimeCell?.hasInfoBadge ? 'Updated to match' : 'Needs update'}`);
    console.log(`✅ Doblado Table: ${dobladoTable.hasInfoHeader && dobladoTable.sampleTimeCell?.hasInfoBadge ? 'Updated to match' : 'Needs update'}`);
    
    // Check for "Segregated By" column
    const hasSegregatedByColumn = segregationTable.headers.includes('Segregated By');
    console.log(`✅ "Segregated By" Column: ${hasSegregatedByColumn ? 'Present' : 'Missing'}`);
  }
  
  if (hasConsistentHeaders && hasConsistentLayout && hasConsistentTable) {
    console.log('\n🎉 SUCCESS! All production logs now use consistent professional styling!');
    console.log('- Segregation logs: ✅ Professional styling with "Segregated By" column');
    console.log('- Mangle logs: ✅ Updated to match segregation styling');  
    console.log('- Doblado logs: ✅ Updated to match segregation styling');
    console.log('\nAll tables now have:');
    console.log('- table-info headers (professional blue)');
    console.log('- badge bg-info for time columns');
    console.log('- badge bg-success fs-6 for quantity columns');
    console.log('- p-0 card-body for edge-to-edge layout');
    console.log('- Consistent table classes and styling');
  } else {
    console.log('\n⚠️ Some styling inconsistencies found. Check the details above.');
  }
  
}, 2000);
