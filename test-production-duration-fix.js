#!/usr/bin/env node

/**
 * Test Production Duration Fix
 * Verifies that the end-of-shift detection now shows correct production duration
 * from start time to last item (not current time)
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://reactapp-6c4cc-default-rtdb.firebaseio.com"
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function testProductionDurationFix() {
  console.log('\n🧪 Testing Production Duration Fix...\n');

  try {
    // Create test data with specific timestamps
    const testData = {
      // First item at 8:00 AM
      firstItem: new Date('2025-08-17T08:00:00'),
      // Last item at 2:10 PM  
      lastItem: new Date('2025-08-17T14:10:00'),
      // Expected duration: 6.17 hours (6h 10m)
      expectedDuration: 6.17
    };

    console.log('📊 Test Scenario:');
    console.log(`   Start time: ${testData.firstItem.toLocaleTimeString()}`);
    console.log(`   End time: ${testData.lastItem.toLocaleTimeString()}`);
    console.log(`   Expected duration: ${testData.expectedDuration}h\n`);

    // Calculate duration manually to verify logic
    const calculatedDuration = (testData.lastItem.getTime() - testData.firstItem.getTime()) / (1000 * 60 * 60);
    console.log(`🔢 Manual calculation: ${calculatedDuration.toFixed(2)}h`);

    // Create test cart with items at these timestamps
    const testCartRef = db.collection('completedCarts').doc('test-duration-fix');
    
    await testCartRef.set({
      clientName: 'Test Duration Fix',
      completedAt: testData.lastItem,
      totalItems: 2,
      items: [
        {
          productName: 'Test Mangle Item',
          quantity: 5,
          addedAt: testData.firstItem.toISOString()
        },
        {
          productName: 'Test Mangle Item 2',
          quantity: 3,
          addedAt: testData.lastItem.toISOString()
        }
      ]
    });

    console.log('✅ Test data created in Firebase');
    
    // Import the service to test
    const { ShiftEndDetectionService } = require('./src/services/ShiftEndDetectionService.ts');
    
    // Wait a moment for the service to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const service = new ShiftEndDetectionService();
    const summary = service.getCurrentSummary();
    
    if (summary) {
      console.log('\n📋 Service Results:');
      console.log(`   Production Start: ${summary.productionStartTime?.toLocaleTimeString()}`);
      console.log(`   Production End: ${summary.estimatedEndTime?.toLocaleTimeString()}`);
      console.log(`   Production Duration: ${summary.productionDuration.toFixed(2)}h`);
      console.log(`   Time Since Last Item: ${summary.totalIdleTime.toFixed(0)} minutes`);
      
      // Verify the fix
      const durationDiff = Math.abs(summary.productionDuration - testData.expectedDuration);
      if (durationDiff < 0.1) {
        console.log('\n✅ SUCCESS: Production duration is calculated correctly!');
        console.log('   🎯 Shows actual production span (start to last item)');
        console.log('   🎯 Not showing elapsed time to current time');
      } else {
        console.log('\n❌ ISSUE: Production duration calculation may be incorrect');
        console.log(`   Expected: ${testData.expectedDuration}h`);
        console.log(`   Actual: ${summary.productionDuration.toFixed(2)}h`);
      }
    } else {
      console.log('\n⚠️  No summary available - service may still be initializing');
    }

    // Clean up test data
    await testCartRef.delete();
    console.log('\n🧹 Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testProductionDurationFix()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test error:', error);
    process.exit(1);
  });
