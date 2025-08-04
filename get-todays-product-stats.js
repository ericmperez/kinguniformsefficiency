#!/usr/bin/env node

// Get today's product statistics with percentages
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Firebase configuration (using your existing config)
const firebaseConfig = {
  apiKey: "AIzaSyBLzCjU5d4VNVfyWz7TCYpXEXUWP-zS7bM",
  authDomain: "king-uniforms-react-app.firebaseapp.com",
  projectId: "king-uniforms-react-app",
  storageBucket: "king-uniforms-react-app.firebasestorage.app",
  messagingSenderId: "1040677100448",
  appId: "1:1040677100448:web:a7fbde8c86d9ac8b5e7df7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getTodaysProductStats() {
  try {
    console.log('🔍 Fetching today\'s product statistics...\n');
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    console.log(`📅 Analyzing data for: ${today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })} (${todayStr})\n`);

    // Load invoices
    console.log('🔄 Loading invoices from Firebase...');
    const invoicesSnapshot = await getDocs(collection(db, "invoices"));
    const invoices = invoicesSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));

    console.log(`📋 Total invoices in database: ${invoices.length}`);
    
    // Show recent invoice dates for debugging
    const recentInvoices = invoices
      .filter(inv => inv.date)
      .map(inv => ({
        id: inv.id,
        date: new Date(inv.date).toISOString().slice(0, 10),
        clientName: inv.clientName
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    
    console.log('\n🗓️  Most recent invoices:');
    recentInvoices.forEach(inv => {
      console.log(`   ${inv.date} - ${inv.clientName} (${inv.id})`);
    });

    // Filter invoices for today
    const todayInvoices = invoices.filter(invoice => {
      if (!invoice.date) return false;
      const invoiceDate = new Date(invoice.date).toISOString().slice(0, 10);
      return invoiceDate === todayStr;
    });

    console.log(`\n📊 Found ${todayInvoices.length} invoices for today`);

    if (todayInvoices.length === 0) {
      console.log('❌ No invoices found for today.');
      console.log('\n💡 Let\'s try to get statistics for the most recent day with data...\n');
      
      // Find the most recent date with invoices
      const datesWithInvoices = [...new Set(invoices
        .filter(inv => inv.date)
        .map(inv => new Date(inv.date).toISOString().slice(0, 10)))]
        .sort((a, b) => b.localeCompare(a));
      
      if (datesWithInvoices.length === 0) {
        console.log('❌ No invoices with dates found in the database.');
        return;
      }
      
      const mostRecentDate = datesWithInvoices[0];
      console.log(`📅 Using most recent date with data: ${new Date(mostRecentDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })} (${mostRecentDate})`);
      
      // Filter invoices for the most recent date
      const recentInvoices = invoices.filter(invoice => {
        if (!invoice.date) return false;
        const invoiceDate = new Date(invoice.date).toISOString().slice(0, 10);
        return invoiceDate === mostRecentDate;
      });
      
      console.log(`📊 Found ${recentInvoices.length} invoices for this date\n`);
      
      // Use recent invoices instead
      todayInvoices.length = 0;
      todayInvoices.push(...recentInvoices);
    }

    // Calculate product breakdown
    const productBreakdown = {};
    let totalQuantity = 0;

    todayInvoices.forEach(invoice => {
      if (invoice.carts) {
        invoice.carts.forEach(cart => {
          if (cart.items) {
            cart.items.forEach(item => {
              const productName = item.productName;
              const quantity = item.quantity || 0;
              
              if (!productBreakdown[productName]) {
                productBreakdown[productName] = {
                  totalQuantity: 0,
                  totalRevenue: 0,
                  invoiceCount: 0
                };
              }
              
              productBreakdown[productName].totalQuantity += quantity;
              productBreakdown[productName].totalRevenue += quantity * (item.price || 0);
              productBreakdown[productName].invoiceCount += 1;
              totalQuantity += quantity;
            });
          }
        });
      }
    });

    // Sort products by quantity (descending)
    const sortedProducts = Object.entries(productBreakdown)
      .map(([name, data]) => ({
        name,
        quantity: data.totalQuantity,
        revenue: data.totalRevenue,
        invoiceCount: data.invoiceCount,
        percentage: totalQuantity > 0 ? ((data.totalQuantity / totalQuantity) * 100) : 0
      }))
      .sort((a, b) => b.quantity - a.quantity);

    // Display results
    console.log('🏆 TOP PRODUCTS - TODAY\'S STATISTICS\n');
    console.log('=' .repeat(80));
    console.log('Product'.padEnd(30) + 'Quantity'.padEnd(12) + 'Percentage'.padEnd(12) + 'Revenue'.padEnd(12) + 'Invoices');
    console.log('=' .repeat(80));

    let displayedProducts = 0;
    sortedProducts.forEach(product => {
      if (product.quantity > 0) {
        console.log(
          product.name.padEnd(30) + 
          product.quantity.toString().padEnd(12) + 
          `${product.percentage.toFixed(1)}%`.padEnd(12) + 
          `$${product.revenue.toFixed(2)}`.padEnd(12) + 
          product.invoiceCount.toString()
        );
        displayedProducts++;
      }
    });

    if (displayedProducts === 0) {
      console.log('❌ No products found for today.');
    } else {
      console.log('=' .repeat(80));
      console.log(`📈 Total Products: ${displayedProducts}`);
      console.log(`📦 Total Quantity: ${totalQuantity.toLocaleString()}`);
      console.log(`💰 Total Revenue: $${sortedProducts.reduce((sum, p) => sum + p.revenue, 0).toFixed(2)}`);
    }

  } catch (error) {
    console.error('❌ Error fetching product statistics:', error);
  }
}

// Run the script
getTodaysProductStats();
