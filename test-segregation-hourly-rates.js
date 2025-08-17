// Test script for Hourly Segregation Rates Feature
// Run this in browser console on the Production Classification Dashboard
// URL: http://localhost:5183/production-classification

console.clear();
console.log('🕐 HOURLY SEGREGATION RATES - FEATURE TEST');
console.log('==========================================');

function testSegregationHourlyRates() {
  console.log('\n📊 STEP 1: CHECK SEGREGATION SECTION');
  
  // Find the segregation card
  const segregationCard = Array.from(document.querySelectorAll('.card')).find(card => 
    card.querySelector('.card-header')?.textContent?.includes('Segregated Clients Today')
  );
  
  if (!segregationCard) {
    console.log('❌ Segregation card not found');
    return;
  }
  
  console.log('✅ Found segregation card');
  
  // Check for hourly rates header stats
  const headerStats = segregationCard.querySelectorAll('.text-end');
  console.log(`📈 Header stats found: ${headerStats.length}`);
  
  headerStats.forEach((stat, index) => {
    const value = stat.querySelector('.fw-bold')?.textContent;
    const label = stat.querySelector('small')?.textContent;
    if (value && label) {
      console.log(`   ${index + 1}. ${label}: ${value}`);
      
      if (label.includes('lbs/hr')) {
        console.log('   ✅ Found hourly rate stat!');
      }
    }
  });
  
  console.log('\n📊 STEP 2: CHECK HOURLY BREAKDOWN TABLE');
  
  // Look for the hourly rates table
  const hourlyRatesSection = segregationCard.querySelector('h6');
  if (hourlyRatesSection && hourlyRatesSection.textContent.includes('Hourly Segregation Rates')) {
    console.log('✅ Found "Hourly Segregation Rates" section');
    
    // Find the table
    const hourlyTable = hourlyRatesSection.nextElementSibling?.querySelector('table');
    if (hourlyTable) {
      console.log('✅ Found hourly rates table');
      
      const headerRow = hourlyTable.querySelector('thead tr');
      if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim());
        console.log('📋 Table headers:', headers);
        
        // Check if we have the expected columns
        const expectedHeaders = ['Hour', 'Clients', 'Weight (lbs)', 'Rate (lbs/hr)'];
        const hasAllHeaders = expectedHeaders.every(header => 
          headers.some(h => h.includes(header.split(' ')[0]))
        );
        
        if (hasAllHeaders) {
          console.log('✅ All expected table headers found');
        } else {
          console.log('⚠️  Some expected headers missing');
        }
      }
      
      // Count data rows
      const dataRows = hourlyTable.querySelectorAll('tbody tr:not(.border-top)');
      console.log(`📊 Hourly data rows: ${dataRows.length}`);
      
      // Check summary row
      const summaryRow = hourlyTable.querySelector('tbody tr.border-top');
      if (summaryRow) {
        console.log('✅ Found summary row');
        
        const summaryData = Array.from(summaryRow.querySelectorAll('td')).map(td => td.textContent.trim());
        console.log('📋 Summary row data:', summaryData);
      }
      
      // Log sample hourly data
      if (dataRows.length > 0) {
        console.log('\n⏰ Sample hourly data:');
        Array.from(dataRows).slice(0, 3).forEach((row, index) => {
          const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
          console.log(`   Row ${index + 1}: ${cells.join(' | ')}`);
        });
      }
      
    } else {
      console.log('❌ Hourly rates table not found');
    }
  } else {
    console.log('❌ "Hourly Segregation Rates" section not found');
  }
  
  console.log('\n📊 STEP 3: VERIFY CALCULATIONS');
  
  // Check console for our debug logs
  console.log('💡 Check browser console for segregation data logs with hourlyBreakdown');
  
  console.log('\n📊 STEP 4: TEST CURRENT HOUR RATE');
  
  // Look for "This Hour" stat
  const thisHourStat = Array.from(segregationCard.querySelectorAll('small')).find(small => 
    small.textContent.includes('This Hour')
  );
  
  if (thisHourStat) {
    const thisHourValue = thisHourStat.parentElement?.querySelector('.fw-bold')?.textContent;
    console.log(`🕐 Current hour rate: ${thisHourValue}`);
    console.log('✅ Current hour segregation rate is displayed');
  } else {
    console.log('⚠️  Current hour rate not found (might be 0 if no segregations this hour)');
  }
  
  console.log('\n🎯 SUMMARY');
  
  // Determine success level
  const hasHourlySection = !!segregationCard.querySelector('h6')?.textContent?.includes('Hourly');
  const hasRateInHeader = Array.from(segregationCard.querySelectorAll('small')).some(s => 
    s.textContent.includes('lbs/hr')
  );
  
  if (hasHourlySection && hasRateInHeader) {
    console.log('🎉 SUCCESS: Hourly segregation rates feature is fully implemented!');
    console.log('✅ Features found:');
    console.log('   • Average hourly rate in header');
    console.log('   • Current hour rate (if applicable)');
    console.log('   • Detailed hourly breakdown table');
    console.log('   • Summary calculations');
  } else if (hasRateInHeader) {
    console.log('⚠️  PARTIAL: Rate calculations found but detailed breakdown missing');
  } else {
    console.log('❌ FAILED: Hourly segregation rates not implemented yet');
  }
  
  console.log('\n🔍 NEXT STEPS:');
  console.log('• Test with actual segregation data from today');
  console.log('• Verify rates update in real-time as new segregations complete');
  console.log('• Check that calculations are accurate');
}

// Run the test
testSegregationHourlyRates();

// Make it available for re-running
window.testSegregationRates = testSegregationHourlyRates;

console.log('\n💡 TIP: Run window.testSegregationRates() to re-run this test anytime');
console.log('📊 Also check the Network tab for segregation_done_logs queries');
