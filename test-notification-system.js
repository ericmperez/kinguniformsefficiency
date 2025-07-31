// Test script to verify the driver notification system is working
// Run this from the browser console to test the notification system

console.log('🔔 Testing Driver Notification System...');

// Test 1: Check if task scheduler is loaded
try {
  const { triggerDriverAssignmentCheck, getSchedulerStatus } = require('./src/services/taskScheduler');
  console.log('✅ Task scheduler module loaded successfully');
  
  // Test 2: Check scheduler status
  const status = getSchedulerStatus();
  console.log('📋 Scheduler Status:', status);
  
  if (status.length > 0) {
    console.log('✅ Found scheduled tasks:', status.length);
    status.forEach(task => {
      console.log(`  - ${task.name}: ${task.enabled ? 'ENABLED' : 'DISABLED'}, Next: ${task.nextRun || 'Not scheduled'}`);
    });
  } else {
    console.log('⚠️ No scheduled tasks found');
  }
  
} catch (error) {
  console.error('❌ Error testing task scheduler:', error);
}

// Test 3: Check if driver assignment notifier is available
try {
  const { checkUnassignedDrivers } = require('./src/services/driverAssignmentNotifier');
  console.log('✅ Driver assignment notifier module loaded successfully');
} catch (error) {
  console.error('❌ Error loading driver assignment notifier:', error);
}

console.log('🏁 Test completed. Check the console output above for results.');
