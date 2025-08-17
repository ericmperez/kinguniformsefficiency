// Production Report Script - Shows all items processed today with timing
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

async function getTodayProductionReport() {
  console.log('\n📊 KING UNIFORMS - TODAY\'S PRODUCTION REPORT');
  console.log('=' * 60);
  
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  console.log(`📅 Report Date: ${today.toDateString()}`);
  console.log(`⏰ Generated at: ${now.toLocaleString()}\n`);

  try {
    // Get all invoices
    const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
    console.log(`📋 Total invoices in system: ${invoicesSnapshot.size}`);
    
    const allProductionEntries = [];
    let processedInvoices = 0;

    for (const invoiceDoc of invoicesSnapshot.docs) {
      const invoice = invoiceDoc.data();
      const invoiceId = invoiceDoc.id;
      const clientName = invoice.clientName || 'Unknown Client';
      const clientId = invoice.clientId || '';
      const invoiceStatus = invoice.status || 'Unknown';
      const shipped = invoice.shipped || false;
      const done = invoice.done || false;
      const carts = invoice.carts || [];
      
      let invoiceHasItemsToday = false;

      carts.forEach((cart, cartIndex) => {
        const cartId = cart.id || `cart-${cartIndex}`;
        const cartName = cart.name || 'Unknown Cart';
        const items = cart.items || [];

        items.forEach((item, itemIndex) => {
          if (item.addedAt) {
            const itemAddedAt = new Date(item.addedAt);
            
            // ✅ IMPORTANT: Check if item was added today regardless of invoice status
            // This captures all production activity by actual work date, not invoice status
            if (itemAddedAt >= today && itemAddedAt < tomorrow) {
              invoiceHasItemsToday = true;
              
              allProductionEntries.push({
                id: `${invoiceId}-${cartId}-${itemIndex}`,
                invoiceId,
                clientId,
                clientName,
                cartId,
                cartName,
                productName: item.productName || 'Unknown Product',
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
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
                // Include invoice status for verification
                invoiceStatus: invoiceStatus,
                shipped: shipped,
                done: done
              });
            }
          }
        });
      });

      if (invoiceHasItemsToday) {
        processedInvoices++;
      }
    }

    // Sort entries by time
    allProductionEntries.sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

    console.log(`🔄 Invoices with activity today: ${processedInvoices}`);
    console.log(`📦 Total items processed today: ${allProductionEntries.length}`);

    if (allProductionEntries.length === 0) {
      console.log('\n❌ No production entries found for today');
      console.log('This could mean:');
      console.log('  • No items were added to invoices today');
      console.log('  • Items are missing addedAt timestamps');
      console.log('  • Date filtering issue');
      return;
    }

    const firstEntry = allProductionEntries[0];
    const lastEntry = allProductionEntries[allProductionEntries.length - 1];
    const totalQuantity = allProductionEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    
    // Calculate production span
    const productionSpanMs = lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime();
    const productionSpanHours = productionSpanMs / (1000 * 60 * 60);
    const productionSpanMinutes = productionSpanMs / (1000 * 60);

    console.log('\n⏰ TIMING SUMMARY');
    console.log('=' * 30);
    console.log(`🟢 First Item Added: ${firstEntry.timeString}`);
    console.log(`   └─ Product: ${firstEntry.productName} (${firstEntry.quantity} units)`);
    console.log(`   └─ Client: ${firstEntry.clientName}`);
    console.log(`   └─ Added by: ${firstEntry.addedBy}`);
    
    console.log(`🔴 Last Item Added: ${lastEntry.timeString}`);
    console.log(`   └─ Product: ${lastEntry.productName} (${lastEntry.quantity} units)`);
    console.log(`   └─ Client: ${lastEntry.clientName}`);
    console.log(`   └─ Added by: ${lastEntry.addedBy}`);
    
    console.log(`📏 Production Span: ${Math.floor(productionSpanHours)}h ${Math.floor(productionSpanMinutes % 60)}m`);
    
    // Calculate hourly rates
    const currentHour = now.getHours();
    const hoursIntoDay = currentHour + (now.getMinutes() / 60);
    const overallHourlyRate = hoursIntoDay > 0 ? totalQuantity / hoursIntoDay : 0;
    const productionHourlyRate = productionSpanHours > 0 ? totalQuantity / productionSpanHours : 0;
    
    console.log(`\n📈 PRODUCTION RATES`);
    console.log('=' * 30);
    console.log(`📊 Total Units Processed: ${totalQuantity.toLocaleString()}`);
    console.log(`⚡ Overall Rate (since midnight): ${Math.round(overallHourlyRate)} units/hour`);
    console.log(`🏭 Production Rate (active period): ${Math.round(productionHourlyRate)} units/hour`);

    // Hourly breakdown
    const hourlyBreakdown = {};
    allProductionEntries.forEach(entry => {
      const hour = entry.hour;
      if (!hourlyBreakdown[hour]) {
        hourlyBreakdown[hour] = { count: 0, quantity: 0, entries: [] };
      }
      hourlyBreakdown[hour].count++;
      hourlyBreakdown[hour].quantity += entry.quantity;
      hourlyBreakdown[hour].entries.push(entry);
    });

    console.log(`\n⏰ HOURLY BREAKDOWN`);
    console.log('=' * 30);
    Object.keys(hourlyBreakdown)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(hour => {
        const data = hourlyBreakdown[hour];
        const hourStr = hour.toString().padStart(2, '0') + ':00';
        console.log(`${hourStr} - ${data.quantity.toLocaleString()} units (${data.count} items)`);
      });

    // Invoice status breakdown to verify we're capturing shipped/done invoices
    const statusBreakdown = {
      active: { count: 0, quantity: 0 },
      shipped: { count: 0, quantity: 0 },
      done: { count: 0, quantity: 0 },
      unknown: { count: 0, quantity: 0 }
    };

    allProductionEntries.forEach(entry => {
      if (entry.shipped) {
        statusBreakdown.shipped.count++;
        statusBreakdown.shipped.quantity += entry.quantity;
      } else if (entry.done) {
        statusBreakdown.done.count++;
        statusBreakdown.done.quantity += entry.quantity;
      } else if (entry.invoiceStatus && entry.invoiceStatus !== 'Unknown') {
        statusBreakdown.active.count++;
        statusBreakdown.active.quantity += entry.quantity;
      } else {
        statusBreakdown.unknown.count++;
        statusBreakdown.unknown.quantity += entry.quantity;
      }
    });

    console.log(`\n📋 INVOICE STATUS BREAKDOWN`);
    console.log('=' * 40);
    console.log('✅ This shows production work was captured regardless of invoice status:');
    console.log(`🟢 Active Invoices: ${statusBreakdown.active.quantity.toLocaleString()} units (${statusBreakdown.active.count} items)`);
    console.log(`📦 Shipped Invoices: ${statusBreakdown.shipped.quantity.toLocaleString()} units (${statusBreakdown.shipped.count} items)`);
    console.log(`✅ Done Invoices: ${statusBreakdown.done.quantity.toLocaleString()} units (${statusBreakdown.done.count} items)`);
    console.log(`❓ Unknown Status: ${statusBreakdown.unknown.quantity.toLocaleString()} units (${statusBreakdown.unknown.count} items)`);

    // Top products
    const productSummary = {};
    allProductionEntries.forEach(entry => {
      if (!productSummary[entry.productName]) {
        productSummary[entry.productName] = { quantity: 0, count: 0, clients: new Set() };
      }
      productSummary[entry.productName].quantity += entry.quantity;
      productSummary[entry.productName].count++;
      productSummary[entry.productName].clients.add(entry.clientName);
    });

    console.log(`\n🏆 TOP PRODUCTS TODAY`);
    console.log('=' * 30);
    Object.entries(productSummary)
      .sort(([,a], [,b]) => b.quantity - a.quantity)
      .slice(0, 10)
      .forEach(([productName, data], index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${productName}`);
        console.log(`    └─ ${data.quantity.toLocaleString()} units (${data.count} entries, ${data.clients.size} clients)`);
      });

    // Recent activity (last 10 entries)
    console.log(`\n🔄 RECENT ACTIVITY (Last 10 entries)`);
    console.log('=' * 30);
    allProductionEntries
      .slice(-10)
      .reverse()
      .forEach((entry, index) => {
        console.log(`${entry.timeString} - ${entry.productName} (${entry.quantity}) - ${entry.clientName}`);
      });

    console.log('\n✅ Report generation complete!');
    console.log(`📊 Production Classification Dashboard: http://localhost:5178 (Reports → Production Classification)`);

  } catch (error) {
    console.error('❌ Error generating production report:', error);
  }
}

// Run the report
getTodayProductionReport().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
