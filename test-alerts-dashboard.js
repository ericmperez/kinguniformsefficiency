/**
 * Test script for Alerts Dashboard
 * Creates sample alerts to test the dashboard functionality
 * Run this in the browser console when logged into the app
 */

// Function to create test alerts
const createTestAlerts = async () => {
  console.log('🚨 Creating test alerts for dashboard...');
  
  try {
    // Check if we can access Firebase from the app
    if (!window.db) {
      console.log('❌ Firebase not accessible. Make sure you are on the app page.');
      return;
    }

    const { addDoc, collection, Timestamp } = await import('firebase/firestore');
    const db = window.db;
    
    // Sample alerts for testing
    const testAlerts = [
      {
        type: 'segregation_error',
        severity: 'high',
        title: 'Cart Verification Error - ABC Company',
        message: 'Cart count mismatch detected. Expected: 5, Actual: 3. Employee: John Doe',
        component: 'Segregation',
        clientName: 'ABC Company',
        userName: 'John Doe',
        triggerData: {
          expectedCount: 5,
          actualCount: 3,
          groupId: 'test-group-1',
          errorType: 'cart_verification'
        },
        createdBy: 'System',
        createdAt: Timestamp.now(),
        isRead: false,
        isResolved: false
      },
      {
        type: 'driver_assignment',
        severity: 'medium',
        title: 'Unassigned Trucks for Tomorrow',
        message: '3 trucks are unassigned for delivery on 2025-09-06',
        component: 'Shipping',
        triggerData: {
          unassignedTrucks: 3,
          targetDate: '2025-09-06',
          truckNumbers: ['T001', 'T002', 'T003']
        },
        createdBy: 'System',
        createdAt: Timestamp.now(),
        isRead: false,
        isResolved: false
      },
      {
        type: 'system_error',
        severity: 'medium',
        title: 'Pickup Entry Save Error',
        message: 'Failed to save pickup entry for client XYZ Corp, driver Mike Smith, weight 150lbs. Error: Network timeout',
        component: 'Pickup/Washing',
        clientName: 'XYZ Corp',
        userName: 'Mike Smith',
        triggerData: {
          clientId: 'client-123',
          driverId: 'driver-456',
          weight: 150,
          operation: 'save_pickup_entry'
        },
        createdBy: 'System',
        createdAt: Timestamp.now(),
        isRead: true,
        isResolved: false
      },
      {
        type: 'tunnel_issue',
        severity: 'critical',
        title: 'Tunnel Equipment Malfunction',
        message: 'Tunnel washing equipment has stopped responding. Production halted.',
        component: 'Washing/Tunnel',
        triggerData: {
          equipmentId: 'tunnel-main',
          errorCode: 'E001',
          downtime: '15 minutes'
        },
        createdBy: 'System',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)), // 2 hours ago
        isRead: false,
        isResolved: true
      },
      {
        type: 'client_issue',
        severity: 'low',
        title: 'Client Communication Issue',
        message: 'Unable to send email notification to client DEF Industries',
        component: 'Email System',
        clientName: 'DEF Industries',
        triggerData: {
          clientId: 'def-industries',
          emailAddress: 'contact@definitdustries.com',
          errorType: 'smtp_failure'
        },
        createdBy: 'System',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000)), // 30 minutes ago
        isRead: false,
        isResolved: false
      }
    ];

    // Create alerts in Firestore
    const alertsCollection = collection(db, 'system_alerts');
    
    for (let i = 0; i < testAlerts.length; i++) {
      const alert = testAlerts[i];
      const docRef = await addDoc(alertsCollection, alert);
      console.log(`✅ Created test alert ${i + 1}: ${alert.title} (ID: ${docRef.id})`);
    }
    
    console.log('🎉 All test alerts created successfully!');
    console.log('📍 Navigate to Reports → 🚨 Alerts to view the dashboard');
    
  } catch (error) {
    console.error('❌ Error creating test alerts:', error);
  }
};

// Function to clear test alerts
const clearTestAlerts = async () => {
  console.log('🧹 Clearing test alerts...');
  
  try {
    if (!window.db) {
      console.log('❌ Firebase not accessible. Make sure you are on the app page.');
      return;
    }

    const { getDocs, deleteDoc, collection, query, where } = await import('firebase/firestore');
    const db = window.db;
    
    // Get all alerts created by System
    const alertsQuery = query(
      collection(db, 'system_alerts'),
      where('createdBy', '==', 'System')
    );
    
    const snapshot = await getDocs(alertsQuery);
    
    if (snapshot.empty) {
      console.log('ℹ️ No test alerts found to clear.');
      return;
    }
    
    // Delete all test alerts
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`✅ Cleared ${snapshot.docs.length} test alerts`);
    
  } catch (error) {
    console.error('❌ Error clearing test alerts:', error);
  }
};

// Function to check if alerts dashboard is working
const testAlertsDashboard = async () => {
  console.log('🧪 Testing Alerts Dashboard...');
  
  // Check if we're on the correct page
  const currentPath = window.location.pathname;
  console.log(`📍 Current path: ${currentPath}`);
  
  // Look for alerts dashboard elements
  const alertsButton = document.querySelector('button:contains("🚨 Alerts")');
  const alertsDashboard = document.querySelector('[class*="alerts"], [id*="alerts"]');
  
  if (alertsButton) {
    console.log('✅ Alerts navigation button found');
  } else {
    console.log('❌ Alerts navigation button not found - may need to navigate to Reports page');
  }
  
  if (alertsDashboard) {
    console.log('✅ Alerts dashboard component found');
  } else {
    console.log('❌ Alerts dashboard component not found - may need to click Alerts button');
  }
  
  console.log('💡 To test the alerts dashboard:');
  console.log('1. Navigate to Reports page');
  console.log('2. Click "🚨 Alerts" button');
  console.log('3. Run createTestAlerts() to add test data');
  console.log('4. Verify filtering, marking as read/resolved, and deletion work');
  console.log('5. Run clearTestAlerts() to clean up');
};

// Export functions to global scope for easy access
window.createTestAlerts = createTestAlerts;
window.clearTestAlerts = clearTestAlerts;
window.testAlertsDashboard = testAlertsDashboard;

console.log('🚨 Alerts Dashboard Test Script Loaded');
console.log('📋 Available functions:');
console.log('  • createTestAlerts() - Create sample alerts');
console.log('  • clearTestAlerts() - Remove test alerts');
console.log('  • testAlertsDashboard() - Check dashboard status');
console.log('');
console.log('🚀 Run testAlertsDashboard() to start testing');
