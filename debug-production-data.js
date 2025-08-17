// Diagnostic script to find ALL production data for today and show filtering details
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDHzHu2GciKGNpkZshzHdXfIKyZsTVzYtg",
  authDomain: "king-uniforms-21f4a.firebaseapp.com",
  projectId: "king-uniforms-21f4a",
  storageBucket: "king-uniforms-21f4a.appspot.com",
  messagingSenderId: "774767672469",
  appId: "1:774767672469:web:e6dbb6d41a53b7e5ed7b3e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugTodayProductionData() {
  console.log('\n🔍 KING UNIFORMS - PRODUCTION DATA DIAGNOSTIC');
  console.log('='.repeat(80));
  
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  console.log(`📅 Target Date: ${today.toDateString()}`);
  console.log(`⏰ Time Range: ${today.toLocaleString()} to ${tomorrow.toLocaleString()}`);
  console.log(`🕐 Current Time: ${now.toLocaleString()}\n`);

  try {
    // Get all invoices
    const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
    console.log(`📋 Total invoices in system: ${invoicesSnapshot.size}`);
    
    const allRawItems = []; // All items found with addedAt today
    const filteredItems = []; // Items after applying filters
    const skippedItems = []; // Items that were filtered out
    let processedInvoices = 0;
    let invoicesWithTodayItems = 0;

    console.log('\n🔄 Processing invoices...');
    let processingCount = 0;

    for (const invoiceDoc of invoicesSnapshot.docs) {
      const invoice = invoiceDoc.data();
      const invoiceId = invoiceDoc.id;
      const clientName = invoice.clientName || 'Unknown Client';
      const clientId = invoice.clientId || '';
      const invoiceStatus = invoice.status || 'Unknown';
      const shipped = invoice.shipped || false;
      const done = invoice.done || false;
      const carts = invoice.carts || [];
      
      processingCount++;
      if (processingCount % 100 === 0) {
        console.log(`  ... processed ${processingCount} invoices`);
      }
      
      let invoiceHasItemsToday = false;
      let itemsFoundInThisInvoice = 0;

      carts.forEach((cart, cartIndex) => {
        const cartId = cart.id || `cart-${cartIndex}`;
        const cartName = cart.name || 'Unknown Cart';
        const items = cart.items || [];

        items.forEach((item, itemIndex) => {
          if (item.addedAt) {
            const itemAddedAt = new Date(item.addedAt);
            
            // Check if item was added today
            if (itemAddedAt >= today && itemAddedAt < tomorrow) {
              invoiceHasItemsToday = true;
              itemsFoundInThisInvoice++;
              
              const rawItem = {
                id: `${invoiceId}-${cartId}-${itemIndex}`,
                invoiceId,
                clientId,
                clientName,
                cartId,
                cartName,
                productName: item.productName,
                originalProductName: item.productName, // Keep original for debugging
                quantity: item.quantity,
                price: item.price,
                addedBy: item.addedBy || 'Unknown User',
                addedAt: itemAddedAt,
                hour: itemAddedAt.getHours(),
                minute: itemAddedAt.getMinutes(),
                timeString: itemAddedAt.toLocaleTimeString('en-US', {
                  hour12: true,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }),
                invoiceStatus: invoiceStatus,
                shipped: shipped,
                done: done,
                // Debugging fields
                hasProductName: !!item.productName,
                productNameLength: item.productName ? item.productName.length : 0,
                isUnknownProduct: !item.productName || item.productName.toLowerCase().includes('unknown'),
                quantityNumber: Number(item.quantity) || 0,
                isValidQuantity: !!(item.quantity && Number(item.quantity) > 0)
              };
              
              allRawItems.push(rawItem);
              
              // Apply the same filters as ProductionTrackingService
              const shouldSkip = (
                !item.productName || 
                item.productName.toLowerCase().includes('unknown') ||
                !item.quantity || 
                Number(item.quantity) <= 0
              );
              
              if (shouldSkip) {
                skippedItems.push({
                  ...rawItem,
                  skipReason: [
                    !item.productName ? 'No product name' : null,
                    item.productName?.toLowerCase().includes('unknown') ? 'Contains "unknown"' : null,
                    !item.quantity ? 'No quantity' : null,
                    Number(item.quantity) <= 0 ? 'Quantity <= 0' : null
                  ].filter(Boolean).join(', ')
                });
              } else {
                filteredItems.push({
                  ...rawItem,
                  productName: item.productName || 'Unknown Product',
                  quantity: Number(item.quantity) || 0,
                  price: Number(item.price) || 0
                });
              }
            }
          }
        });
      });

      if (invoiceHasItemsToday) {
        invoicesWithTodayItems++;
        if (itemsFoundInThisInvoice > 0) {
          console.log(`  📋 Invoice ${invoiceId.substring(0, 8)}... (${clientName}): ${itemsFoundInThisInvoice} items today`);
        }
      }
      processedInvoices++;
    }

    console.log(`\n📊 DIAGNOSTIC RESULTS`);
    console.log('='.repeat(50));
    console.log(`📋 Total invoices processed: ${processedInvoices}`);
    console.log(`📋 Invoices with items today: ${invoicesWithTodayItems}`);
    console.log(`📦 Raw items found for today: ${allRawItems.length}`);
    console.log(`✅ Items passing filters: ${filteredItems.length}`);
    console.log(`❌ Items filtered out: ${skippedItems.length}`);

    // Show hourly breakdown of ALL raw items
    console.log(`\n⏰ HOURLY BREAKDOWN (ALL RAW ITEMS)`);
    console.log('='.repeat(50));
    const hourlyRawBreakdown = {};
    allRawItems.forEach(item => {
      const hour = item.hour;
      if (!hourlyRawBreakdown[hour]) {
        hourlyRawBreakdown[hour] = { count: 0, totalQuantity: 0, items: [] };
      }
      hourlyRawBreakdown[hour].count++;
      hourlyRawBreakdown[hour].totalQuantity += Number(item.quantity) || 0;
      hourlyRawBreakdown[hour].items.push(item);
    });

    Object.keys(hourlyRawBreakdown)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(hour => {
        const data = hourlyRawBreakdown[hour];
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        console.log(`${hourStr} - ${data.totalQuantity.toLocaleString()} units (${data.count} items)`);
        
        // Show a few sample items for this hour
        const samples = data.items.slice(0, 3);
        samples.forEach(item => {
          console.log(`      ${item.timeString} - ${item.originalProductName || 'NO_NAME'} (${item.quantity || 0}) - ${item.clientName}`);
        });
      });

    // Show hourly breakdown of FILTERED items
    console.log(`\n⏰ HOURLY BREAKDOWN (FILTERED ITEMS ONLY)`);
    console.log('='.repeat(50));
    const hourlyFilteredBreakdown = {};
    filteredItems.forEach(item => {
      const hour = item.hour;
      if (!hourlyFilteredBreakdown[hour]) {
        hourlyFilteredBreakdown[hour] = { count: 0, totalQuantity: 0, items: [] };
      }
      hourlyFilteredBreakdown[hour].count++;
      hourlyFilteredBreakdown[hour].totalQuantity += item.quantity;
      hourlyFilteredBreakdown[hour].items.push(item);
    });

    Object.keys(hourlyFilteredBreakdown)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(hour => {
        const data = hourlyFilteredBreakdown[hour];
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        console.log(`${hourStr} - ${data.totalQuantity.toLocaleString()} units (${data.count} items)`);
      });

    // Show what's being filtered out
    if (skippedItems.length > 0) {
      console.log(`\n❌ ITEMS BEING FILTERED OUT (First 20)`);
      console.log('='.repeat(50));
      skippedItems.slice(0, 20).forEach((item, index) => {
        console.log(`${index + 1}. ${item.timeString} - "${item.originalProductName || 'NO_NAME'}" (${item.quantity || 0})`);
        console.log(`   └─ Reason: ${item.skipReason}`);
        console.log(`   └─ Client: ${item.clientName}`);
        console.log(`   └─ Invoice: ${item.invoiceId.substring(0, 8)}...`);
        console.log('');
      });
    }

    // Show earliest and latest items
    if (allRawItems.length > 0) {
      const sortedRaw = [...allRawItems].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
      const earliest = sortedRaw[0];
      const latest = sortedRaw[sortedRaw.length - 1];
      
      console.log(`\n🕐 TIME RANGE ANALYSIS`);
      console.log('='.repeat(50));
      console.log(`🟢 Earliest item found: ${earliest.timeString}`);
      console.log(`   └─ Product: "${earliest.originalProductName || 'NO_NAME'}" (${earliest.quantity || 0})`);
      console.log(`   └─ Client: ${earliest.clientName}`);
      console.log(`   └─ Filtered out: ${!filteredItems.find(f => f.id === earliest.id) ? 'YES' : 'NO'}`);
      
      console.log(`🔴 Latest item found: ${latest.timeString}`);
      console.log(`   └─ Product: "${latest.originalProductName || 'NO_NAME'}" (${latest.quantity || 0})`);
      console.log(`   └─ Client: ${latest.clientName}`);
      console.log(`   └─ Filtered out: ${!filteredItems.find(f => f.id === latest.id) ? 'YES' : 'NO'}`);
    }

    // Check why data before 13:00 might be missing
    const itemsBefore13 = allRawItems.filter(item => item.hour < 13);
    const filteredItemsBefore13 = filteredItems.filter(item => item.hour < 13);
    
    console.log(`\n🔍 BEFORE 13:00 ANALYSIS`);
    console.log('='.repeat(50));
    console.log(`📦 Raw items before 13:00: ${itemsBefore13.length}`);
    console.log(`✅ Filtered items before 13:00: ${filteredItemsBefore13.length}`);
    console.log(`❌ Items lost to filtering: ${itemsBefore13.length - filteredItemsBefore13.length}`);
    
    if (itemsBefore13.length === 0) {
      console.log(`⚠️  NO ITEMS FOUND BEFORE 13:00!`);
      console.log(`   This suggests either:`);
      console.log(`   • No production actually happened before 13:00 today`);
      console.log(`   • Items don't have proper addedAt timestamps`);
      console.log(`   • There's a timezone issue with the timestamps`);
    } else if (filteredItemsBefore13.length === 0) {
      console.log(`⚠️  ALL ITEMS BEFORE 13:00 WERE FILTERED OUT!`);
      console.log(`   Sample filtered items:`);
      itemsBefore13.slice(0, 5).forEach(item => {
        const skipped = skippedItems.find(s => s.id === item.id);
        console.log(`   • ${item.timeString} - "${item.originalProductName || 'NO_NAME'}" - Reason: ${skipped?.skipReason || 'Unknown'}`);
      });
    }

    console.log(`\n🎯 RECOMMENDATIONS`);
    console.log('='.repeat(50));
    
    if (itemsBefore13.length === 0) {
      console.log(`1. Check if items have addedAt timestamps before 13:00`);
      console.log(`2. Verify timezone settings in your system`);
      console.log(`3. Check if production actually started before 13:00 today`);
    } else if (skippedItems.length > 0) {
      console.log(`1. Consider relaxing filters in ProductionTrackingService.ts`);
      console.log(`2. Review items being filtered out - some might be legitimate`);
      console.log(`3. Update the dashboard to show filtered items separately`);
    }
    
    if (filteredItems.length > 0) {
      console.log(`✅ Current dashboard should show ${filteredItems.length} items`);
      console.log(`📊 Dashboard URL: http://localhost:5178 (Reports → Production Classification)`);
    }

    console.log('\n✅ Diagnostic complete!');
    
    return {
      raw: allRawItems,
      filtered: filteredItems,
      skipped: skippedItems
    };

  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
    throw error;
  }
}

// Run the diagnostic
debugTodayProductionData().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
