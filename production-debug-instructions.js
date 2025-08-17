// Instructions for debugging Production Classification Dashboard data

// STEP 1: Navigate to your dashboard
// Go to: http://localhost:5182
// Click "Reports" → "Production Classification"

// STEP 2: Open Browser Console  
// Press F12 or right-click → "Inspect" → "Console" tab

// STEP 3: Copy and paste this entire script into the console and press Enter:

console.log('🔍 PRODUCTION DATA DIAGNOSTIC - START');
console.log('=====================================');

async function quickDebug() {
  try {
    console.log('📊 Checking Production Data...');
    
    // Try to access Firebase from global scope
    const db = window.db || window.firebase?.firestore();
    if (!db) {
      console.log('❌ Firebase not available in global scope');
      console.log('Make sure you\'re on the Production Classification Dashboard page');
      return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    console.log(`📅 Searching for items added today: ${today.toDateString()}`);
    
    const invoicesSnapshot = await db.collection('invoices').get();
    console.log(`📋 Scanning ${invoicesSnapshot.size} invoices...`);
    
    let totalItemsFound = 0;
    let totalValidItems = 0;
    const hourlyData = {};
    const firstEntries = [];
    
    invoicesSnapshot.docs.forEach(doc => {
      const invoice = doc.data();
      const carts = invoice.carts || [];
      
      carts.forEach(cart => {
        const items = cart.items || [];
        
        items.forEach(item => {
          if (item.addedAt) {
            const itemDate = item.addedAt.toDate ? item.addedAt.toDate() : new Date(item.addedAt);
            
            if (itemDate >= today && itemDate < tomorrow) {
              totalItemsFound++;
              
              const hour = itemDate.getHours();
              const isValid = item.productName && Number(item.quantity) > 0;
              
              if (isValid) {
                totalValidItems++;
                if (!hourlyData[hour]) hourlyData[hour] = 0;
                hourlyData[hour] += Number(item.quantity);
                
                firstEntries.push({
                  time: itemDate,
                  hour: hour,
                  product: item.productName,
                  quantity: item.quantity,
                  client: invoice.clientName || 'Unknown'
                });
              }
            }
          }
        });
      });
    });
    
    firstEntries.sort((a, b) => a.time - b.time);
    
    console.log(`\n📊 RESULTS:`);
    console.log(`📦 Total items found today: ${totalItemsFound}`);
    console.log(`✅ Valid items (with product name + quantity > 0): ${totalValidItems}`);
    
    if (firstEntries.length > 0) {
      console.log(`🕐 First item: ${firstEntries[0].time.toLocaleTimeString()} - ${firstEntries[0].product}`);
      console.log(`🕐 Last item: ${firstEntries[firstEntries.length - 1].time.toLocaleTimeString()} - ${firstEntries[firstEntries.length - 1].product}`);
    }
    
    console.log(`\n⏰ HOURLY BREAKDOWN:`);
    const sortedHours = Object.keys(hourlyData).map(Number).sort((a, b) => a - b);
    
    if (sortedHours.length === 0) {
      console.log('❌ NO DATA FOUND FOR ANY HOUR TODAY');
      console.log('This could mean:');
      console.log('• No items were actually added today');
      console.log('• Items are missing addedAt timestamps');  
      console.log('• All items have quantity = 0 or no product name');
    } else {
      sortedHours.forEach(hour => {
        const count = hourlyData[hour];
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        console.log(`${hourStr}: ${count.toLocaleString()} units`);
      });
      
      if (sortedHours[0] >= 13) {
        console.log(`\n⚠️  ISSUE FOUND: Earliest data is at ${sortedHours[0]}:00`);
        console.log('No data found before 13:00 - this matches your observation!');
      } else {
        console.log(`\n✅ Data found starting from ${sortedHours[0]}:00`);
      }
    }
    
    // Check dashboard state
    console.log(`\n📱 DASHBOARD CHECK:`);
    const dashboardData = window.productionSummary || window.React?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    if (dashboardData) {
      console.log('✅ Dashboard data object found');
    } else {
      console.log('❌ Dashboard data not found in window scope');
    }
    
    console.log(`\n🎯 NEXT STEPS:`);
    if (totalValidItems === 0) {
      console.log('1. Check if any items were actually added today');
      console.log('2. Verify items have proper addedAt timestamps');
      console.log('3. Check if productName and quantity fields are populated');
    } else if (sortedHours[0] >= 13) {
      console.log('1. Data exists but only from 13:00 onwards');
      console.log('2. Check if items added before 13:00 have valid product names');
      console.log('3. The ProductionTrackingService filtering might be too strict');
    } else {
      console.log('1. Data looks good - check dashboard refresh');
      console.log('2. Try refreshing the Production Classification page');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Run the debug
quickDebug();

console.log('\n🔧 Additional Commands:');
console.log('To see raw invoice data: quickDebug()');
console.log('To refresh: location.reload()');
console.log('=====================================');
