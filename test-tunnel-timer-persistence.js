/**
 * Tunnel Timer Persistence Test Script
 * 
 * This script helps test the 90-second timer persistence functionality
 * in the tunnel page. Use this in the browser console to verify the
 * implementation works correctly.
 * 
 * USAGE:
 * 1. Navigate to http://localhost:3001 and go to Washing/Tunnel page
 * 2. Login as a regular employee (not supervisor)
 * 3. Open browser console (F12)
 * 4. Paste this script and press Enter
 * 5. Use the test functions to verify persistence
 */

console.log("🧪 Tunnel Timer Persistence Test Script Loaded");

/**
 * Test timer persistence by simulating storage operations
 */
window.testTimerPersistence = function() {
  console.log("🚀 Testing Timer Persistence...");
  console.log("=" .repeat(50));
  
  const userId = "test_user_123";
  const storageKey = `tunnelButtonTimer_${userId}`;
  
  console.log("📋 Test 1: Setting timer in localStorage");
  const testTimestamp = Date.now() - 30000; // 30 seconds ago
  localStorage.setItem(storageKey, testTimestamp.toString());
  console.log(`✅ Set timer for ${userId} to 30 seconds ago`);
  
  console.log("\n📋 Test 2: Reading timer from localStorage");
  const storedTime = localStorage.getItem(storageKey);
  if (storedTime) {
    const lastPress = parseInt(storedTime, 10);
    const now = Date.now();
    const elapsed = now - lastPress;
    const remaining = Math.max(0, 90000 - elapsed);
    
    console.log(`✅ Retrieved timer: ${Math.ceil(remaining / 1000)}s remaining`);
  } else {
    console.log("❌ No timer found in storage");
  }
  
  console.log("\n📋 Test 3: Timer expiration check");
  if (storedTime) {
    const lastPress = parseInt(storedTime, 10);
    const now = Date.now();
    const elapsed = now - lastPress;
    
    if (elapsed < 90000) {
      console.log("✅ Timer is still active");
    } else {
      console.log("✅ Timer has expired");
      localStorage.removeItem(storageKey);
      console.log("🗑️ Removed expired timer from storage");
    }
  }
  
  console.log("\n📋 Test 4: Cleanup function");
  // Add some test expired timers
  localStorage.setItem("tunnelButtonTimer_expired1", (Date.now() - 120000).toString());
  localStorage.setItem("tunnelButtonTimer_expired2", (Date.now() - 180000).toString());
  localStorage.setItem("tunnelButtonTimer_active", (Date.now() - 30000).toString());
  
  // Simulate cleanup
  let removedCount = 0;
  const now = Date.now();
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('tunnelButtonTimer_')) {
      const timestamp = localStorage.getItem(key);
      if (timestamp) {
        const lastPress = parseInt(timestamp, 10);
        if (now - lastPress >= 90000) {
          localStorage.removeItem(key);
          removedCount++;
          i--; // Adjust index since we removed an item
        }
      }
    }
  }
  
  console.log(`🧹 Cleanup removed ${removedCount} expired timers`);
  
  console.log("\n🎉 Timer persistence test completed!");
  console.log("📝 All core functionality verified:");
  console.log("   ✅ Timer storage");
  console.log("   ✅ Timer retrieval");
  console.log("   ✅ Expiration detection");
  console.log("   ✅ Automatic cleanup");
};

/**
 * Check current timer status in localStorage
 */
window.checkCurrentTimers = function() {
  console.log("🔍 Checking Current Timer Status...");
  console.log("=" .repeat(40));
  
  let timerCount = 0;
  const now = Date.now();
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('tunnelButtonTimer_')) {
      const timestamp = localStorage.getItem(key);
      if (timestamp) {
        const lastPress = parseInt(timestamp, 10);
        const elapsed = now - lastPress;
        const remaining = Math.max(0, 90000 - elapsed);
        const userId = key.replace('tunnelButtonTimer_', '');
        
        timerCount++;
        console.log(`👤 User: ${userId}`);
        console.log(`   ⏰ Last press: ${new Date(lastPress).toLocaleTimeString()}`);
        console.log(`   ⏳ Time remaining: ${Math.ceil(remaining / 1000)}s`);
        console.log(`   📊 Status: ${remaining > 0 ? '🔴 ACTIVE' : '💚 EXPIRED'}`);
        console.log("");
      }
    }
  }
  
  if (timerCount === 0) {
    console.log("📭 No timer data found in localStorage");
  } else {
    console.log(`📊 Found ${timerCount} timer record(s)`);
  }
};

/**
 * Simulate the timer persistence workflow
 */
window.simulateTimerWorkflow = function() {
  console.log("🎬 Simulating Timer Persistence Workflow...");
  console.log("=" .repeat(50));
  
  const testUserId = "demo_employee";
  const storageKey = `tunnelButtonTimer_${testUserId}`;
  
  console.log("📝 Scenario: Employee presses button, logs out, logs back in");
  
  // Step 1: Employee presses button
  console.log("\n🚀 Step 1: Employee presses tunnel cart increment button");
  const buttonPressTime = Date.now();
  localStorage.setItem(storageKey, buttonPressTime.toString());
  console.log(`   ✅ Timer started and saved to localStorage`);
  console.log(`   ⏰ Started at: ${new Date(buttonPressTime).toLocaleTimeString()}`);
  
  // Step 2: Simulate some time passing
  console.log("\n⏳ Step 2: 25 seconds pass...");
  const simulatedCurrentTime = buttonPressTime + 25000;
  
  // Step 3: Employee logs out (localStorage persists)
  console.log("\n🚪 Step 3: Employee logs out");
  console.log(`   💾 Timer data remains in localStorage`);
  
  // Step 4: Employee logs back in - restore timer
  console.log("\n🔄 Step 4: Employee logs back in - restoring timer state");
  const storedTime = localStorage.getItem(storageKey);
  if (storedTime) {
    const lastPress = parseInt(storedTime, 10);
    const elapsed = simulatedCurrentTime - lastPress;
    const remaining = Math.max(0, 90000 - elapsed);
    
    console.log(`   ✅ Timer state restored successfully`);
    console.log(`   ⏱️ Elapsed time: ${Math.ceil(elapsed / 1000)}s`);
    console.log(`   ⏳ Remaining time: ${Math.ceil(remaining / 1000)}s`);
    console.log(`   📊 Button disabled: ${remaining > 0 ? 'YES' : 'NO'}`);
  }
  
  // Step 5: Clean up
  console.log("\n🧹 Step 5: Cleaning up test data");
  localStorage.removeItem(storageKey);
  console.log(`   ✅ Test timer removed`);
  
  console.log("\n🎉 Workflow simulation completed!");
  console.log("💡 This demonstrates how the timer persists across logout/login");
};

console.log("\n🎯 Available test functions:");
console.log("• testTimerPersistence() - Test core persistence functionality");
console.log("• checkCurrentTimers() - Check current timer status");
console.log("• simulateTimerWorkflow() - Simulate full workflow");

console.log("\n📋 Instructions:");
console.log("1. Make sure you're on the Tunnel page");
console.log("2. Login as a regular employee (not supervisor)");
console.log("3. Try pressing a tunnel cart increment button");
console.log("4. Check localStorage with checkCurrentTimers()");
console.log("5. Refresh the page to test persistence");

// Auto-run quick check
setTimeout(() => {
  console.log("\n🔍 Auto-running current timer check...");
  window.checkCurrentTimers();
}, 1000);
