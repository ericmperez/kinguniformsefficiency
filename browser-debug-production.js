// Browser Console Debug Script - Paste this into browser console on your dashboard
// This will show you ALL production data for today and explain what's being filtered

console.log('🔍 Starting Production Data Debug...');

// Function to analyze production data
async function debugProductionData() {
  try {
    // Get Firebase instance from your app
    const db = window.firebase?.firestore() || window.db;
    if (!db) {
      console.error('❌ Firebase not found. Make sure you\'re on your dashboard page.');
      return;
    }

    console.log('📊 Connected to Firebase, analyzing today\'s data...');
    
    // Get today's date range
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    console.log(`📅 Analyzing: ${today.toDateString()}`);
    console.log(`⏰ Time range: ${today.toLocaleString()} to ${tomorrow.toLocaleString()}`);
    
    // Get all invoices
    const invoicesSnapshot = await db.collection('invoices').get();
    console.log(`📋 Total invoices in system: ${invoicesSnapshot.size}`);
    
    const allItems = [];
    const filteredItems = [];
    const skippedItems = [];
    let invoicesWithTodayData = 0;
    
    invoicesSnapshot.docs.forEach(doc => {
      const invoice = doc.data();
      const invoiceId = doc.id;
      const carts = invoice.carts || [];
      let hasItemsToday = false;
      
      carts.forEach((cart, cartIndex) => {
        const items = cart.items || [];
        
        items.forEach((item, itemIndex) => {
          if (item.addedAt) {
            const itemDate = item.addedAt.toDate ? item.addedAt.toDate() : new Date(item.addedAt);
            
            if (itemDate >= today && itemDate < tomorrow) {
              hasItemsToday = true;
              
              const itemData = {
                id: `${invoiceId}-${cartIndex}-${itemIndex}`,
                invoiceId: invoiceId.substring(0, 8),
                client: invoice.clientName || 'Unknown',
                product: item.productName,
                originalProduct: item.productName,
                quantity: item.quantity,
                time: itemDate,
                timeString: itemDate.toLocaleTimeString(),
                hour: itemDate.getHours(),
                addedBy: item.addedBy,
                invoiceStatus: invoice.status,
                shipped: invoice.shipped,
                done: invoice.done
              };
              
              allItems.push(itemData);
              
              // Apply the same filters as the dashboard
              const shouldSkip = !item.productName || 
                               item.productName.toLowerCase().includes('unknown') ||
                               !item.quantity || 
                               Number(item.quantity) <= 0;
              
              if (shouldSkip) {
                skippedItems.push({
                  ...itemData,
                  reason: [
                    !item.productName ? 'No product name' : null,
                    item.productName?.toLowerCase().includes('unknown') ? 'Contains "unknown"' : null,
                    !item.quantity ? 'No quantity' : null,
                    Number(item.quantity) <= 0 ? 'Quantity <= 0' : null
                  ].filter(Boolean).join(', ')
                });
              } else {
                filteredItems.push(itemData);
              }
            }
          }
        });
      });
      
      if (hasItemsToday) {
        invoicesWithTodayData++;
      }
    });
    
    // Sort by time
    allItems.sort((a, b) => a.time - b.time);
    filteredItems.sort((a, b) => a.time - b.time);
    
    console.log('\n📊 ANALYSIS RESULTS:');
    console.log('='.repeat(50));
    console.log(`📋 Invoices with today's data: ${invoicesWithTodayData}`);
    console.log(`📦 Total items found: ${allItems.length}`);
    console.log(`✅ Items passing filters: ${filteredItems.length}`);
    console.log(`❌ Items filtered out: ${skippedItems.length}`);
    
    if (allItems.length === 0) {
      console.log('\n❌ NO ITEMS FOUND FOR TODAY!');
      console.log('Possible reasons:');
      console.log('• No production work was done today');
      console.log('• Items are missing addedAt timestamps');
      console.log('• Timezone issues with timestamps');
      return;
    }
    
    // Show time range
    const earliest = allItems[0];
    const latest = allItems[allItems.length - 1];
    
    console.log('\n⏰ TIME RANGE:');
    console.log(`🟢 First: ${earliest.timeString} - ${earliest.product} (${earliest.quantity})`);
    console.log(`🔴 Last: ${latest.timeString} - ${latest.product} (${latest.quantity})`);
    
    // Hourly breakdown
    console.log('\n📊 HOURLY BREAKDOWN (All Items):');
    const hourlyBreakdown = {};
    allItems.forEach(item => {
      const hour = item.hour;
      if (!hourlyBreakdown[hour]) {
        hourlyBreakdown[hour] = { count: 0, quantity: 0, items: [] };
      }
      hourlyBreakdown[hour].count++;
      hourlyBreakdown[hour].quantity += Number(item.quantity) || 0;
      hourlyBreakdown[hour].items.push(item);
    });
    
    Object.keys(hourlyBreakdown)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(hour => {
        const data = hourlyBreakdown[hour];
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        console.log(`${hourStr}: ${data.quantity.toLocaleString()} units (${data.count} items)`);
        
        // Show first few items for this hour
        data.items.slice(0, 2).forEach(item => {
          console.log(`  └─ ${item.timeString} - ${item.product || 'NO_NAME'} (${item.quantity || 0}) - ${item.client}`);
        });
      });
    
    // Check what's being filtered before 13:00
    const itemsBefore13 = allItems.filter(item => item.hour < 13);
    const filteredBefore13 = filteredItems.filter(item => item.hour < 13);
    
    console.log('\n🔍 BEFORE 13:00 ANALYSIS:');
    console.log(`📦 Raw items before 13:00: ${itemsBefore13.length}`);
    console.log(`✅ Filtered items before 13:00: ${filteredBefore13.length}`);
    
    if (itemsBefore13.length === 0) {
      console.log('⚠️  NO ITEMS FOUND BEFORE 13:00');
      console.log('This means no production data exists before 13:00 today');
    } else if (filteredBefore13.length === 0) {
      console.log('⚠️  ALL ITEMS BEFORE 13:00 WERE FILTERED OUT');
      console.log('Filtered items:');
      const skippedBefore13 = skippedItems.filter(item => item.hour < 13);
      skippedBefore13.slice(0, 5).forEach(item => {
        console.log(`  • ${item.timeString} - "${item.originalProduct || 'NO_NAME'}" - ${item.reason}`);
      });
    }
    
    // Show what dashboard should display
    if (filteredItems.length > 0) {
      console.log('\n✅ DASHBOARD DATA:');
      console.log(`The dashboard should show ${filteredItems.length} items`);
      console.log('Recent items:');
      filteredItems.slice(-5).reverse().forEach(item => {
        console.log(`  • ${item.timeString} - ${item.product} (${item.quantity}) - ${item.client}`);
      });
    }
    
    // Store results for further inspection
    window.debugResults = {
      all: allItems,
      filtered: filteredItems,
      skipped: skippedItems,
      hourly: hourlyBreakdown
    };
    
    console.log('\n💾 Results stored in window.debugResults for further inspection');
    console.log('Use: window.debugResults.all, .filtered, .skipped, .hourly');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

// Run the debug
debugProductionData();

// Also provide helper functions
window.showHour = function(hour) {
  if (!window.debugResults) {
    console.log('Run debugProductionData() first');
    return;
  }
  
  const items = window.debugResults.all.filter(item => item.hour === hour);
  console.log(`📊 Items for ${hour.toString().padStart(2, '0')}:00:`);
  items.forEach(item => {
    console.log(`  ${item.timeString} - ${item.product || 'NO_NAME'} (${item.quantity || 0}) - ${item.client}`);
  });
};

window.showFiltered = function() {
  if (!window.debugResults) {
    console.log('Run debugProductionData() first');
    return;
  }
  
  console.log('❌ Filtered out items:');
  window.debugResults.skipped.forEach(item => {
    console.log(`  ${item.timeString} - "${item.originalProduct || 'NO_NAME'}" - ${item.reason}`);
  });
};

console.log('✅ Debug script loaded!');
console.log('📖 Navigate to Reports → Production Classification, then check the console output');
console.log('🔧 Available functions: showHour(13), showFiltered()');
