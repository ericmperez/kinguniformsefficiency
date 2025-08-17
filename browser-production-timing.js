// Browser console script to get today's production timing
// Run this in the browser console while on the Production Classification Dashboard

console.log('📊 GETTING TODAY\'S PRODUCTION TIMING...\n');

// Get the production data from the dashboard component
const getProductionTiming = () => {
  // Try to access the production service data
  const productionService = window.ProductionTrackingService || 
                           (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED);
  
  console.log('🔍 Accessing Firebase directly...');
  
  // Access Firebase from the global window object
  if (window.firebase || window.db) {
    const db = window.db || window.firebase.firestore();
    
    console.log('🔥 Firebase connection found, querying invoices...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`📅 Looking for items added between ${today.toISOString()} and ${tomorrow.toISOString()}`);
    
    db.collection('invoices').get().then(snapshot => {
      console.log(`📋 Found ${snapshot.size} total invoices`);
      
      const allEntries = [];
      let processedInvoices = 0;
      
      snapshot.forEach(doc => {
        const invoice = doc.data();
        const invoiceId = doc.id;
        const carts = invoice.carts || [];
        let hasItemsToday = false;
        
        carts.forEach(cart => {
          const items = cart.items || [];
          
          items.forEach(item => {
            if (item.addedAt) {
              const addedAt = new Date(item.addedAt);
              
              if (addedAt >= today && addedAt < tomorrow) {
                hasItemsToday = true;
                allEntries.push({
                  time: addedAt,
                  timeString: addedAt.toLocaleString(),
                  product: item.productName,
                  quantity: item.quantity,
                  client: invoice.clientName,
                  addedBy: item.addedBy,
                  invoiceId: invoiceId.substring(0, 8),
                  cart: cart.name
                });
              }
            }
          });
        });
        
        if (hasItemsToday) processedInvoices++;
      });
      
      // Sort by time
      allEntries.sort((a, b) => a.time.getTime() - b.time.getTime());
      
      console.log(`\n📊 PRODUCTION SUMMARY FOR ${today.toDateString()}`);
      console.log('='.repeat(60));
      console.log(`🔄 Active invoices today: ${processedInvoices}`);
      console.log(`📦 Total items processed: ${allEntries.length}`);
      
      if (allEntries.length === 0) {
        console.log('\n❌ No items were added to invoices today');
        return;
      }
      
      const firstEntry = allEntries[0];
      const lastEntry = allEntries[allEntries.length - 1];
      const totalUnits = allEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
      
      console.log(`\n⏰ TIMING INFORMATION`);
      console.log('='.repeat(40));
      console.log(`🟢 FIRST PRODUCT ADDED: ${firstEntry.timeString}`);
      console.log(`   Product: ${firstEntry.product} (${firstEntry.quantity} units)`);
      console.log(`   Client: ${firstEntry.client}`);
      console.log(`   Added by: ${firstEntry.addedBy}`);
      console.log(`   Invoice: ${firstEntry.invoiceId}...`);
      
      console.log(`\n🔴 LAST PRODUCT ADDED: ${lastEntry.timeString}`);
      console.log(`   Product: ${lastEntry.product} (${lastEntry.quantity} units)`);
      console.log(`   Client: ${lastEntry.client}`);
      console.log(`   Added by: ${lastEntry.addedBy}`);
      console.log(`   Invoice: ${lastEntry.invoiceId}...`);
      
      const spanMs = lastEntry.time.getTime() - firstEntry.time.getTime();
      const spanHours = Math.floor(spanMs / (1000 * 60 * 60));
      const spanMinutes = Math.floor((spanMs % (1000 * 60 * 60)) / (1000 * 60));
      
      console.log(`\n📏 Production timespan: ${spanHours}h ${spanMinutes}m`);
      console.log(`📊 Total units processed: ${totalUnits.toLocaleString()}`);
      
      console.log(`\n📋 ALL PRODUCTS PROCESSED TODAY (${allEntries.length} items)`);
      console.log('='.repeat(80));
      console.log('TIME'.padEnd(20) + 'PRODUCT'.padEnd(25) + 'QTY'.padEnd(8) + 'CLIENT'.padEnd(15) + 'USER');
      console.log('-'.repeat(80));
      
      allEntries.forEach((entry, index) => {
        const time = entry.time.toLocaleTimeString();
        const product = (entry.product || 'Unknown').substring(0, 24);
        const qty = (entry.quantity || 0).toString();
        const client = (entry.client || 'Unknown').substring(0, 14);
        const user = (entry.addedBy || 'Unknown').substring(0, 10);
        
        console.log(
          time.padEnd(20) + 
          product.padEnd(25) + 
          qty.padEnd(8) + 
          client.padEnd(15) + 
          user
        );
      });
      
      console.log('\n✅ Production timing report complete!');
      
    }).catch(error => {
      console.error('❌ Error querying Firestore:', error);
    });
    
  } else {
    console.log('❌ Firebase not found in global scope. Make sure you\'re on the dashboard page.');
  }
};

// Run the function
getProductionTiming();
