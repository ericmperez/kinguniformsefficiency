// Test script to verify segregation data fetching fix
// Run this in browser console on the Production Classification Dashboard

console.log('🧪 TESTING SEGREGATION DATA FIX');
console.log('===============================');

// Wait for React component to load
setTimeout(() => {
  // Check if segregation card is visible
  const segregationCard = document.querySelector('.card.border-info');
  
  if (segregationCard) {
    console.log('✅ Segregation card found');
    
    const headerText = segregationCard.querySelector('.card-header h5')?.textContent;
    console.log('📄 Header text:', headerText);
    
    // Check for loading state
    const loading = segregationCard.querySelector('.spinner-border');
    if (loading) {
      console.log('⏳ Data is still loading...');
      
      // Check again in 3 seconds
      setTimeout(() => {
        console.log('\n🔄 CHECKING AGAIN AFTER LOADING...');
        const table = segregationCard.querySelector('table');
        const rows = table?.querySelectorAll('tbody tr');
        console.log(`📊 Found ${rows?.length || 0} segregation entries`);
        
        if (rows && rows.length > 0) {
          console.log('✅ SEGREGATION DATA IS NOW VISIBLE!');
          Array.from(rows).slice(0, 3).forEach((row, i) => {
            const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());
            console.log(`  Entry ${i+1}: ${cells[1]} - ${cells[2]} - ${cells[0]}`);
          });
        } else {
          const emptyMessage = segregationCard.querySelector('.fa-clipboard-list');
          if (emptyMessage) {
            console.log('ℹ️ Empty state message is showing (no data in last 24h)');
          }
        }
      }, 3000);
      
    } else {
      // Check current state
      const table = segregationCard.querySelector('table');
      const rows = table?.querySelectorAll('tbody tr');
      console.log(`📊 Found ${rows?.length || 0} segregation entries immediately`);
      
      if (rows && rows.length > 0) {
        console.log('✅ SEGREGATION DATA IS VISIBLE!');
      } else {
        console.log('ℹ️ No segregation data (could be empty state or still loading)');
      }
    }
    
  } else {
    console.log('❌ Segregation card still not found');
    
    // List all cards
    const allCards = document.querySelectorAll('.card');
    console.log(`Found ${allCards.length} total cards:`);
    allCards.forEach((card, i) => {
      const header = card.querySelector('.card-header h5, h5')?.textContent?.trim();
      console.log(`  ${i+1}. ${header || 'No header'}`);
    });
  }
  
}, 1000);

console.log('⏳ Waiting 1 second for page to load...');
