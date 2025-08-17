// Test script to verify segregation data is showing ALL items for today
// Run this in browser console on the Production Classification Dashboard

console.log("🧪 [SEGREGATION DATA TEST] Starting verification...");

// Check the current segregation state
const checkSegregationData = () => {
  // Look for segregation data in React component state
  const dashboardElement = document.querySelector('[data-testid="segregation-log"]') || 
                          document.querySelector('.card-header:contains("Segregated Clients Today")');
  
  if (dashboardElement) {
    console.log("✅ Found segregation section");
    
    // Count visible rows in the segregation table
    const segregationRows = document.querySelectorAll('tbody tr');
    const segregationTable = document.querySelector('table');
    
    if (segregationTable && segregationTable.closest('.card-header')?.textContent?.includes('Segregated Clients')) {
      const tableRows = segregationTable.querySelectorAll('tbody tr');
      console.log(`📊 Visible segregation rows: ${tableRows.length}`);
      
      // Log details of each row
      tableRows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const clientName = cells[0]?.textContent?.trim();
          const weight = cells[1]?.textContent?.trim();
          const time = cells[2]?.textContent?.trim();
          console.log(`   ${index + 1}. ${clientName} - ${weight} - ${time}`);
        }
      });
      
      // Check for any "showing X of Y" indicators
      const showMoreText = document.body.textContent;
      if (showMoreText.includes('showing') && showMoreText.includes('of')) {
        console.warn("⚠️ Found 'showing X of Y' text - might indicate pagination");
      }
      
      // Check React state if accessible
      if (window.React) {
        console.log("🔍 Checking React state for segregation data...");
        // This would require React DevTools or direct state access
      }
      
    } else {
      console.log("❓ Segregation table structure not found");
    }
  } else {
    console.log("❌ Segregation section not found on page");
  }
  
  // Check browser network tab for API calls
  console.log("📡 Check Network tab for Firestore queries to 'segregation_done_logs'");
  console.log("📊 Look for query parameters - should NOT include 'limit' for segregation data");
};

// Also check the production logs section for comparison
const checkProductionLogsData = () => {
  console.log("\n🔍 Comparing with Production Logs section...");
  
  const productionLogCards = document.querySelectorAll('.card');
  productionLogCards.forEach(card => {
    const header = card.querySelector('.card-header');
    if (header && header.textContent.includes('Production Logs')) {
      console.log("✅ Found production logs section");
      const tbody = card.querySelector('tbody');
      if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        console.log(`📊 Production log rows: ${rows.length}`);
      }
    }
  });
};

// Run the checks
checkSegregationData();
checkProductionLogsData();

console.log("\n🧪 [TEST COMPLETE] Segregation data verification finished");
console.log("💡 TIP: If you see fewer segregation entries than expected:");
console.log("   1. Check if all segregations were completed today");
console.log("   2. Verify the segregation_done_logs collection in Firestore");
console.log("   3. Check browser Network tab for the actual query being sent");
