const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('./firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://king-uniforms-default-rtdb.firebaseio.com/"
  });
}

const db = admin.firestore();

async function createTestSpecialItem() {
  try {
    console.log('Creating test special item...');
    
    // Create a test special item
    const testItem = {
      clientId: 'test-client-id',
      clientName: 'Test Client - Special Items Demo',
      productId: 'test-product-id', 
      productName: 'Baby Blankets',
      quantity: 5,
      weight: 2.5,
      washed: true,
      delivered: false,
      invoiceId: 'test-invoice-123',
      createdAt: admin.firestore.Timestamp.now(),
      
      // Special item properties
      isSpecialItem: true,
      category: 'blankets',
      requiresConfirmation: true,
      confirmationStatus: 'pending',
      
      // Additional tracking
      reminderSent: false,
      reminderCount: 0
    };
    
    const docRef = await db.collection('manual_conventional_products').add(testItem);
    console.log('✅ Test special item created with ID:', docRef.id);
    console.log('📋 Item details:', {
      productName: testItem.productName,
      category: testItem.category,
      status: testItem.confirmationStatus,
      clientName: testItem.clientName
    });
    
    console.log('\n🎯 Now go to the Home page to see the Special Items Reminder widget!');
    console.log('🔗 http://localhost:5178/');
    
  } catch (error) {
    console.error('❌ Error creating test special item:', error);
  }
}

createTestSpecialItem();
