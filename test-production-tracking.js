/**
 * Test script for Production Tracking based on Invoice Items
 * This script demonstrates how the production tracking system works with real invoice data
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('./firebase-service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://react-app-3a37b-default-rtdb.firebaseio.com"
  });
}

const db = admin.firestore();

async function createTestInvoiceWithItems() {
  console.log('🧪 Creating test invoice with production items...');

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Create a test invoice with multiple carts and items
  const testInvoice = {
    clientId: 'test-client-production',
    clientName: 'Production Test Client',
    date: today,
    products: [],
    total: 0,
    carts: [
      {
        id: 'cart-1-' + Date.now(),
        name: 'Sabanas Cart',
        items: [
          {
            productId: 'sabana-queen',
            productName: 'Queen Size Sabanas',
            quantity: 150,
            price: 2.50,
            addedBy: 'TestUser',
            addedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
          },
          {
            productId: 'sabana-king',
            productName: 'King Size Sabanas',
            quantity: 75,
            price: 3.00,
            addedBy: 'TestUser',
            addedAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString() // 90 minutes ago
          }
        ],
        total: 0,
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        createdBy: 'TestUser'
      },
      {
        id: 'cart-2-' + Date.now(),
        name: 'Towels Cart',
        items: [
          {
            productId: 'towel-bath',
            productName: 'Bath Towels',
            quantity: 200,
            price: 1.75,
            addedBy: 'TestUser',
            addedAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString() // 45 minutes ago
          },
          {
            productId: 'towel-hand',
            productName: 'Hand Towels',
            quantity: 300,
            price: 1.25,
            addedBy: 'TestUser',
            addedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString() // 30 minutes ago (active!)
          }
        ],
        total: 0,
        createdAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        createdBy: 'TestUser'
      },
      {
        id: 'cart-3-' + Date.now(),
        name: 'Recent Items',
        items: [
          {
            productId: 'uniform-scrub',
            productName: 'Medical Scrubs',
            quantity: 50,
            price: 4.00,
            addedBy: 'TestUser',
            addedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString() // 10 minutes ago (very active!)
          },
          {
            productId: 'blanket-wool',
            productName: 'Wool Blankets',
            quantity: 25,
            price: 8.00,
            addedBy: 'TestUser',
            addedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString() // 5 minutes ago (very active!)
          }
        ],
        total: 0,
        createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        createdBy: 'TestUser'
      }
    ],
    totalWeight: 500,
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  try {
    const docRef = await db.collection('invoices').add(testInvoice);
    console.log('✅ Test invoice created with ID:', docRef.id);
    
    console.log('\n📊 Expected Production Metrics:');
    console.log('- Total Items Added Today:', 150 + 75 + 200 + 300 + 50 + 25, '=', 800);
    console.log('- Active Products (last 30 min):', 'Hand Towels, Medical Scrubs, Wool Blankets');
    console.log('- Hourly Rates:');
    console.log('  • Queen Sabanas: ~75/hr (150 items over 2 hours)');
    console.log('  • King Sabanas: ~50/hr (75 items over 1.5 hours)');  
    console.log('  • Bath Towels: ~267/hr (200 items over 45 minutes)');
    console.log('  • Hand Towels: ~600/hr (300 items over 30 minutes)');
    console.log('  • Medical Scrubs: ~300/hr (50 items over 10 minutes)');
    console.log('  • Wool Blankets: ~300/hr (25 items over 5 minutes)');
    
    console.log('\n🎯 Check the Real-Time Operations Dashboard to see these metrics!');
    console.log('URL: http://localhost:5177/realTimeOperations');
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating test invoice:', error);
    throw error;
  }
}

async function addMoreItemsToSimulateRealTime() {
  console.log('\n🔄 Adding more items to simulate real-time production...');
  
  // Find our test invoice
  const invoicesSnapshot = await db.collection('invoices')
    .where('clientName', '==', 'Production Test Client')
    .limit(1)
    .get();
  
  if (invoicesSnapshot.empty) {
    console.log('No test invoice found');
    return;
  }
  
  const invoiceDoc = invoicesSnapshot.docs[0];
  const invoiceData = invoiceDoc.data();
  const now = new Date();
  
  // Add new items to the first cart
  const updatedCarts = [...invoiceData.carts];
  updatedCarts[0].items.push({
    productId: 'sabana-twin',
    productName: 'Twin Size Sabanas',
    quantity: 100,
    price: 2.00,
    addedBy: 'TestUser',
    addedAt: now.toISOString() // Right now!
  });
  
  // Update the invoice
  await invoiceDoc.ref.update({
    carts: updatedCarts,
    updatedAt: now.toISOString()
  });
  
  console.log('✅ Added 100 Twin Size Sabanas to simulate real-time activity');
  console.log('🔄 The dashboard should update automatically!');
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  const invoicesSnapshot = await db.collection('invoices')
    .where('clientName', '==', 'Production Test Client')
    .get();
  
  const batch = db.batch();
  invoicesSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log('✅ Test data cleaned up');
}

async function main() {
  try {
    console.log('🏭 Production Tracking Test Suite');
    console.log('===================================');
    
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create test invoice with items added at different times
    const invoiceId = await createTestInvoiceWithItems();
    
    // Wait 3 seconds, then add more items to simulate real-time activity
    console.log('\n⏰ Waiting 3 seconds before adding more items...');
    setTimeout(async () => {
      try {
        await addMoreItemsToSimulateRealTime();
        
        console.log('\n🎉 Production tracking test complete!');
        console.log('💡 Visit http://localhost:5177/realTimeOperations to see the metrics');
        console.log('📱 The dashboard shows:');
        console.log('   • Total items added today');  
        console.log('   • Current hourly production rate');
        console.log('   • Active products (added in last 30 minutes)');
        console.log('   • Hourly breakdown chart');
        console.log('   • Top producing items with rates');
        
        // Optional: Clean up after 30 seconds
        setTimeout(async () => {
          console.log('\n⏰ Auto-cleanup in 5 seconds...');
          setTimeout(async () => {
            await cleanupTestData();
            console.log('🏁 Test complete and cleaned up!');
            process.exit(0);
          }, 5000);
        }, 25000);
        
      } catch (error) {
        console.error('❌ Error in real-time simulation:', error);
      }
    }, 3000);
    
  } catch (error) {
    console.error('❌ Error in main test:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = {
  createTestInvoiceWithItems,
  addMoreItemsToSimulateRealTime,
  cleanupTestData
};
