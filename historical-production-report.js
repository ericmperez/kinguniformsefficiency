// Historical Production Report System - Query any date or date range
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, Timestamp, addDoc } from 'firebase/firestore';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

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

// Create reports directory if it doesn't exist
const reportsDir = path.join(process.cwd(), 'production-reports');
if (!existsSync(reportsDir)) {
  await mkdir(reportsDir, { recursive: true });
}

// Helper function to format date for display
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to format date for filename
function formatDateForFilename(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Parse date from command line argument
function parseDate(dateString) {
  if (!dateString) return null;
  
  // Handle different date formats
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // YYYY-MM-DD format
    return new Date(dateString + 'T00:00:00');
  } else if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    // MM/DD/YYYY format
    return new Date(dateString);
  } else if (dateString.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
    // MM-DD-YYYY format
    const [month, day, year] = dateString.split('-');
    return new Date(`${month}/${day}/${year}`);
  } else {
    // Try to parse as is
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }
}

// Main function to generate production report for a specific date
async function getProductionReport(targetDate = null) {
  const reportDate = targetDate || new Date();
  const startDate = new Date(reportDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  const isToday = formatDateForFilename(reportDate) === formatDateForFilename(new Date());
  const reportTitle = isToday ? "TODAY'S PRODUCTION REPORT" : `HISTORICAL PRODUCTION REPORT - ${formatDate(reportDate)}`;

  console.log(`\n📊 KING UNIFORMS - ${reportTitle}`);
  console.log('='.repeat(80));
  console.log(`📅 Report Date: ${formatDate(reportDate)}`);
  console.log(`⏰ Generated at: ${new Date().toLocaleString()}\n`);

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
      
      let invoiceHasItemsForDate = false;

      carts.forEach((cart, cartIndex) => {
        const cartId = cart.id || `cart-${cartIndex}`;
        const cartName = cart.name || 'Unknown Cart';
        const items = cart.items || [];

        items.forEach((item, itemIndex) => {
          if (item.addedAt) {
            const itemAddedAt = new Date(item.addedAt);
            
            // ✅ IMPORTANT: Check if item was added on target date regardless of invoice status
            // This captures all production activity by actual work date, not invoice status
            if (itemAddedAt >= startDate && itemAddedAt < endDate) {
              invoiceHasItemsForDate = true;
              
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

      if (invoiceHasItemsForDate) {
        processedInvoices++;
      }
    }

    // Sort entries by time
    allProductionEntries.sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

    console.log(`🔄 Invoices with activity: ${processedInvoices}`);
    console.log(`📦 Total items processed: ${allProductionEntries.length}`);

    if (allProductionEntries.length === 0) {
      console.log('\n❌ No production entries found for this date');
      console.log('This could mean:');
      console.log('  • No items were added to invoices on this date');
      console.log('  • Items are missing addedAt timestamps');
      console.log('  • Date filtering issue');
      
      // Save empty report
      const reportData = {
        date: formatDateForFilename(reportDate),
        displayDate: formatDate(reportDate),
        isEmpty: true,
        totalItems: 0,
        totalQuantity: 0,
        generatedAt: new Date().toISOString()
      };
      
      await saveReport(reportData);
      return reportData;
    }

    const firstEntry = allProductionEntries[0];
    const lastEntry = allProductionEntries[allProductionEntries.length - 1];
    const totalQuantity = allProductionEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    
    // Calculate production span
    const productionSpanMs = lastEntry.addedAt.getTime() - firstEntry.addedAt.getTime();
    const productionSpanHours = productionSpanMs / (1000 * 60 * 60);
    const productionSpanMinutes = productionSpanMs / (1000 * 60);

    console.log('\n⏰ TIMING SUMMARY');
    console.log('='.repeat(50));
    console.log(`🟢 First Item Added: ${firstEntry.timeString}`);
    console.log(`   └─ Product: ${firstEntry.productName} (${firstEntry.quantity} units)`);
    console.log(`   └─ Client: ${firstEntry.clientName}`);
    console.log(`   └─ Added by: ${firstEntry.addedBy}`);
    
    console.log(`🔴 Last Item Added: ${lastEntry.timeString}`);
    console.log(`   └─ Product: ${lastEntry.productName} (${lastEntry.quantity} units)`);
    console.log(`   └─ Client: ${lastEntry.clientName}`);
    console.log(`   └─ Added by: ${lastEntry.addedBy}`);
    
    console.log(`📏 Production Span: ${Math.floor(productionSpanHours)}h ${Math.floor(productionSpanMinutes % 60)}m`);
    
    // Calculate rates based on actual production time vs full day
    const endOfDayHour = isToday ? new Date().getHours() + (new Date().getMinutes() / 60) : 24;
    const overallHourlyRate = endOfDayHour > 0 ? totalQuantity / endOfDayHour : 0;
    const productionHourlyRate = productionSpanHours > 0 ? totalQuantity / productionSpanHours : 0;
    
    console.log(`\n📈 PRODUCTION RATES`);
    console.log('='.repeat(50));
    console.log(`📊 Total Units Processed: ${totalQuantity.toLocaleString()}`);
    console.log(`⚡ Overall Rate: ${Math.round(overallHourlyRate)} units/hour`);
    console.log(`🏭 Production Rate (active period): ${Math.round(productionHourlyRate)} units/hour`);

    // Hourly breakdown
    const hourlyBreakdown = {};
    allProductionEntries.forEach(entry => {
      const hour = entry.hour;
      if (!hourlyBreakdown[hour]) {
        hourlyBreakdown[hour] = { count: 0, quantity: 0, entries: [], clients: new Set(), products: {} };
      }
      hourlyBreakdown[hour].count++;
      hourlyBreakdown[hour].quantity += entry.quantity;
      hourlyBreakdown[hour].entries.push(entry);
      hourlyBreakdown[hour].clients.add(entry.clientName);
      
      if (!hourlyBreakdown[hour].products[entry.productName]) {
        hourlyBreakdown[hour].products[entry.productName] = 0;
      }
      hourlyBreakdown[hour].products[entry.productName] += entry.quantity;
    });

    console.log(`\n⏰ HOURLY BREAKDOWN`);
    console.log('='.repeat(50));
    const sortedHours = Object.keys(hourlyBreakdown).map(Number).sort((a, b) => a - b);
    
    sortedHours.forEach(hour => {
      const data = hourlyBreakdown[hour];
      const hourStr = hour.toString().padStart(2, '0') + ':00';
      const topProducts = Object.entries(data.products)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([name, qty]) => `${name} (${qty})`)
        .join(', ');
      
      console.log(`${hourStr} - ${data.quantity.toLocaleString()} units (${data.count} items, ${data.clients.size} clients)`);
      if (topProducts) {
        console.log(`      Top products: ${topProducts}`);
      }
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
    console.log('='.repeat(50));
    console.log('✅ Production work captured regardless of current invoice status:');
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

    console.log(`\n🏆 TOP PRODUCTS`);
    console.log('='.repeat(50));
    const topProducts = Object.entries(productSummary)
      .sort(([,a], [,b]) => b.quantity - a.quantity)
      .slice(0, 10);
    
    topProducts.forEach(([productName, data], index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${productName}`);
      console.log(`    └─ ${data.quantity.toLocaleString()} units (${data.count} entries, ${data.clients.size} clients)`);
    });

    // Client summary
    const clientSummary = {};
    allProductionEntries.forEach(entry => {
      if (!clientSummary[entry.clientName]) {
        clientSummary[entry.clientName] = { quantity: 0, count: 0, products: new Set() };
      }
      clientSummary[entry.clientName].quantity += entry.quantity;
      clientSummary[entry.clientName].count++;
      clientSummary[entry.clientName].products.add(entry.productName);
    });

    console.log(`\n👥 CLIENT SUMMARY`);
    console.log('='.repeat(50));
    Object.entries(clientSummary)
      .sort(([,a], [,b]) => b.quantity - a.quantity)
      .slice(0, 10)
      .forEach(([clientName, data], index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${clientName}`);
        console.log(`    └─ ${data.quantity.toLocaleString()} units (${data.count} items, ${data.products.size} products)`);
      });

    // Create comprehensive report data
    const reportData = {
      date: formatDateForFilename(reportDate),
      displayDate: formatDate(reportDate),
      isEmpty: false,
      summary: {
        totalItems: allProductionEntries.length,
        totalQuantity: totalQuantity,
        processedInvoices: processedInvoices,
        uniqueProducts: Object.keys(productSummary).length,
        uniqueClients: Object.keys(clientSummary).length,
        firstEntry: {
          time: firstEntry.timeString,
          product: firstEntry.productName,
          client: firstEntry.clientName,
          quantity: firstEntry.quantity,
          addedBy: firstEntry.addedBy
        },
        lastEntry: {
          time: lastEntry.timeString,
          product: lastEntry.productName,
          client: lastEntry.clientName,
          quantity: lastEntry.quantity,
          addedBy: lastEntry.addedBy
        },
        productionSpan: {
          hours: Math.floor(productionSpanHours),
          minutes: Math.floor(productionSpanMinutes % 60),
          totalMinutes: Math.floor(productionSpanMinutes)
        },
        rates: {
          overall: Math.round(overallHourlyRate),
          production: Math.round(productionHourlyRate)
        }
      },
      hourlyBreakdown: sortedHours.map(hour => ({
        hour: hour,
        hourDisplay: hour.toString().padStart(2, '0') + ':00',
        items: hourlyBreakdown[hour].count,
        quantity: hourlyBreakdown[hour].quantity,
        clients: hourlyBreakdown[hour].clients.size,
        topProducts: Object.entries(hourlyBreakdown[hour].products)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([name, qty]) => ({ name, quantity: qty }))
      })),
      topProducts: topProducts.map(([name, data]) => ({
        name,
        quantity: data.quantity,
        items: data.count,
        clients: data.clients.size
      })),
      clientSummary: Object.entries(clientSummary)
        .sort(([,a], [,b]) => b.quantity - a.quantity)
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          items: data.count,
          products: data.products.size
        })),
      entries: allProductionEntries.map(entry => ({
        time: entry.timeString,
        hour: entry.hour,
        product: entry.productName,
        quantity: entry.quantity,
        client: entry.clientName,
        addedBy: entry.addedBy,
        invoiceId: entry.invoiceId
      })),
      generatedAt: new Date().toISOString()
    };

    // Save the report
    await saveReport(reportData);

    console.log('\n✅ Report generation complete!');
    console.log(`💾 Report saved to: production-reports/${formatDateForFilename(reportDate)}.json`);
    
    if (isToday) {
      console.log(`📊 Live Dashboard: http://localhost:5178 (Reports → Production Classification)`);
    }

    return reportData;

  } catch (error) {
    console.error('❌ Error generating production report:', error);
    throw error;
  }
}

// Save report to file and optionally to Firebase
async function saveReport(reportData) {
  const filename = `${reportData.date}.json`;
  const filepath = path.join(reportsDir, filename);
  
  try {
    // Save to local file
    await writeFile(filepath, JSON.stringify(reportData, null, 2));
    
    // Optionally save to Firebase for web access (commented out to avoid duplicate data)
    /*
    try {
      await addDoc(collection(db, 'productionReports'), reportData);
      console.log('📤 Report also saved to Firebase');
    } catch (fbError) {
      console.log('⚠️  Could not save to Firebase:', fbError.message);
    }
    */
  } catch (error) {
    console.error('❌ Error saving report:', error);
  }
}

// Search function to find reports by date range or keywords
async function searchReports(searchTerm) {
  console.log(`\n🔍 SEARCHING PRODUCTION REPORTS: "${searchTerm}"`);
  console.log('='.repeat(60));
  
  const files = await readdir(reportsDir).catch(() => []);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    console.log('No reports found. Generate some reports first.');
    return;
  }
  
  const results = [];
  
  for (const file of jsonFiles) {
    try {
      const filepath = path.join(reportsDir, file);
      const content = await readFile(filepath, 'utf-8');
      const report = JSON.parse(content);
      
      // Search in various fields
      const searchIn = [
        report.displayDate,
        report.date,
        JSON.stringify(report.topProducts),
        JSON.stringify(report.clientSummary),
        JSON.stringify(report.entries)
      ].join(' ').toLowerCase();
      
      if (searchIn.includes(searchTerm.toLowerCase())) {
        results.push({ file, report });
      }
    } catch (error) {
      console.log(`Error reading ${file}:`, error.message);
    }
  }
  
  if (results.length === 0) {
    console.log(`No reports found matching "${searchTerm}"`);
    return;
  }
  
  console.log(`Found ${results.length} matching report(s):\n`);
  
  results.forEach(({ file, report }) => {
    console.log(`📅 ${report.displayDate} (${report.date})`);
    if (!report.isEmpty) {
      console.log(`   📊 ${report.summary.totalQuantity.toLocaleString()} units, ${report.summary.totalItems} items`);
      console.log(`   ⏰ ${report.summary.firstEntry.time} - ${report.summary.lastEntry.time}`);
      console.log(`   🏆 Top: ${report.topProducts[0]?.name || 'N/A'}`);
      console.log(`   👥 Clients: ${report.summary.uniqueClients}`);
    } else {
      console.log(`   ❌ No production activity`);
    }
    console.log(`   💾 File: ${file}\n`);
  });
}

// Generate reports for a date range
async function generateDateRange(startDateStr, endDateStr) {
  const startDate = parseDate(startDateStr);
  const endDate = parseDate(endDateStr);
  
  if (!startDate || !endDate) {
    console.error('❌ Invalid date format. Use YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY');
    return;
  }
  
  if (startDate > endDate) {
    console.error('❌ Start date must be before end date');
    return;
  }
  
  console.log(`\n📅 GENERATING REPORTS FROM ${formatDate(startDate)} TO ${formatDate(endDate)}`);
  console.log('='.repeat(80));
  
  const currentDate = new Date(startDate);
  const reports = [];
  
  while (currentDate <= endDate) {
    console.log(`\n🔄 Processing ${formatDate(currentDate)}...`);
    
    try {
      const report = await getProductionReport(new Date(currentDate));
      reports.push(report);
      
      if (!report.isEmpty) {
        console.log(`✅ ${report.summary.totalQuantity} units, ${report.summary.totalItems}`);
      } else {
        console.log(`⚪ No activity`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${formatDate(currentDate)}:`, error.message);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Summary
  const totalReports = reports.length;
  const activeReports = reports.filter(r => !r.isEmpty);
  const totalUnits = activeReports.reduce((sum, r) => sum + (r.summary?.totalQuantity || 0), 0);
  
  console.log(`\n📊 BATCH SUMMARY`);
  console.log('='.repeat(40));
  console.log(`📅 Date Range: ${totalReports} days`);
  console.log(`🔄 Active Days: ${activeReports.length}`);
  console.log(`📊 Total Units: ${totalUnits.toLocaleString()}`);
  console.log(`📈 Average per Active Day: ${activeReports.length > 0 ? Math.round(totalUnits / activeReports.length) : 0}`);
  
  return reports;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('\n📊 KING UNIFORMS - HISTORICAL PRODUCTION REPORTS');
    console.log('='.repeat(60));
    console.log('Usage:');
    console.log('  node historical-production-report.js today');
    console.log('  node historical-production-report.js date 2024-01-15');
    console.log('  node historical-production-report.js date 1/15/2024');
    console.log('  node historical-production-report.js range 2024-01-01 2024-01-31');
    console.log('  node historical-production-report.js search "client name"');
    console.log('  node historical-production-report.js search "product name"');
    console.log('');
    console.log('Date formats supported: YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY');
    return;
  }
  
  try {
    switch (command.toLowerCase()) {
      case 'today':
        await getProductionReport();
        break;
        
      case 'date':
        const targetDate = parseDate(args[1]);
        if (!targetDate) {
          console.error('❌ Invalid date format');
          return;
        }
        await getProductionReport(targetDate);
        break;
        
      case 'range':
        if (args.length < 3) {
          console.error('❌ Range command requires start and end dates');
          return;
        }
        await generateDateRange(args[1], args[2]);
        break;
        
      case 'search':
        if (args.length < 2) {
          console.error('❌ Search command requires a search term');
          return;
        }
        const { readdir } = await import('fs/promises');
        await searchReports(args.slice(1).join(' '));
        break;
        
      default:
        console.error('❌ Unknown command. Use: today, date, range, or search');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { getProductionReport, searchReports, generateDateRange };
