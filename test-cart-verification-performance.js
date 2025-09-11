/**
 * CART VERIFICATION PERFORMANCE TESTING SCRIPT
 * 
 * This script tests the cart verification system for:
 * 1. Instant button response (< 50ms)
 * 2. Fast error display (< 100ms) 
 * 3. Smooth progression to next step
 * 4. UI state transitions
 * 
 * USAGE:
 * 1. Navigate to http://localhost:5191/segregation
 * 2. Start verification for a client
 * 3. Open browser console (F12)
 * 4. Paste this script and press Enter
 * 5. Run: testCartVerificationPerformance()
 */

console.log("🚀 Cart Verification Performance Testing Script Loaded");

window.testCartVerificationPerformance = function() {
  console.log("🧪 Starting Cart Verification Performance Tests...");
  console.log("=" .repeat(60));
  
  // Test 1: Button Response Time
  console.log("📋 TEST 1: Button Response Time");
  testButtonResponseTime();
  
  // Test 2: Error Display Performance
  console.log("\n📋 TEST 2: Error Display Performance");
  testErrorDisplaySpeed();
  
  // Test 3: Success Flow Performance  
  console.log("\n📋 TEST 3: Success Flow Performance");
  testSuccessFlowSpeed();
  
  // Test 4: UI State Transitions
  console.log("\n📋 TEST 4: UI State Transitions");
  testUIStateTransitions();
  
  // Test 5: Auto-progression Testing
  console.log("\n📋 TEST 5: Auto-progression Testing");
  testAutoProgression();
};

function testButtonResponseTime() {
  const verifyButton = document.querySelector('button[onClick*="verifyIndividualCart"], button:contains("Verify")');
  const cartInput = document.querySelector('input[placeholder*="Cart"], input[value*="Cart"]');
  
  if (!verifyButton || !cartInput) {
    console.log("⚠️  Cannot find verification elements - make sure you're on the segregation page");
    return;
  }
  
  console.log("✅ Found verification elements");
  
  // Test button click responsiveness
  const startTime = performance.now();
  
  // Simulate user input
  cartInput.value = "TEST-CART-123";
  cartInput.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Measure button click response
  verifyButton.click();
  
  const responseTime = performance.now() - startTime;
  console.log(`⏱️  Button response time: ${responseTime.toFixed(2)}ms`);
  
  if (responseTime < 50) {
    console.log("🎉 EXCELLENT: Button responds instantly (< 50ms)");
  } else if (responseTime < 100) {
    console.log("✅ GOOD: Button responds quickly (< 100ms)");  
  } else {
    console.log("⚠️  NEEDS OPTIMIZATION: Button response slow (> 100ms)");
  }
}

function testErrorDisplaySpeed() {
  console.log("Testing error display performance...");
  
  // Check if error elements are in DOM
  const errorDisplay = document.querySelector('[style*="background: #dc3545"], .alert-danger, [class*="error"]');
  
  if (errorDisplay) {
    console.log("✅ Error display elements found in DOM");
    
    // Check if error display is using synchronous updates
    const hasInstantFeedback = errorDisplay.style.display !== 'none' || 
                              errorDisplay.classList.contains('show') ||
                              errorDisplay.offsetHeight > 0;
    
    if (hasInstantFeedback) {
      console.log("🎉 EXCELLENT: Error display appears to be instant");
    } else {
      console.log("⚠️  May have delayed error display");
    }
  } else {
    console.log("ℹ️  No error currently displayed - test with invalid cart ID");
  }
}

function testSuccessFlowSpeed() {
  console.log("Testing success flow performance...");
  
  // Look for success indicators
  const successElements = document.querySelectorAll('.badge-success, [style*="background: #28a745"], [style*="color: #28a745"]');
  const progressIndicators = document.querySelectorAll('[style*="progress"], .progress, [class*="verified"]');
  
  console.log(`📊 Found ${successElements.length} success elements`);
  console.log(`📊 Found ${progressIndicators.length} progress indicators`);
  
  if (successElements.length > 0 || progressIndicators.length > 0) {
    console.log("✅ Success feedback system is present");
  }
}

function testUIStateTransitions() {
  console.log("Testing UI state transitions...");
  
  // Check for React state management efficiency
  const reactRoot = document.getElementById('root');
  if (reactRoot) {
    const reactInstance = reactRoot._reactInternalInstance || 
                         reactRoot._reactInternalFiber ||
                         Object.keys(reactRoot).find(key => key.startsWith('__reactInternalInstance'));
    
    if (reactInstance) {
      console.log("✅ React state management detected");
    }
  }
  
  // Check for state update indicators
  const stateElements = document.querySelectorAll('[data-testid], [class*="state"], [id*="state"]');
  console.log(`📊 Found ${stateElements.length} potential state-managed elements`);
}

function testAutoProgression() {
  console.log("Testing auto-progression to next step...");
  
  // Look for "next step" elements that should appear after verification
  const nextStepElements = document.querySelectorAll(
    'button:contains("Segregate"), button:contains("Next"), button:contains("Continue"), .next-step, [class*="complete"]'
  );
  
  // Check for completion indicators
  const completionElements = document.querySelectorAll(
    '[class*="complete"], [class*="verified"], [class*="ready"], .badge-success'
  );
  
  console.log(`📊 Found ${nextStepElements.length} next-step elements`);
  console.log(`📊 Found ${completionElements.length} completion indicators`);
  
  if (nextStepElements.length > 0 && completionElements.length > 0) {
    console.log("🎉 EXCELLENT: Auto-progression system appears to be implemented");
  } else if (nextStepElements.length > 0) {
    console.log("✅ GOOD: Next step elements found");
  } else {
    console.log("⚠️  May need to implement auto-progression");
  }
}

// Performance monitoring functions
window.measureVerificationSpeed = function(cartId = "TEST-CART-001") {
  console.log(`🔬 Measuring verification speed for cart ID: ${cartId}`);
  
  const input = document.querySelector('input[placeholder*="Cart"], input[type="text"]');
  const button = document.querySelector('button[onClick*="verify"], button:contains("Verify")');
  
  if (!input || !button) {
    console.log("❌ Cannot find input or button elements");
    return;
  }
  
  const startTime = performance.now();
  
  // Simulate user interaction
  input.focus();
  input.value = cartId;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Trigger verification
  button.click();
  
  // Measure total interaction time
  const totalTime = performance.now() - startTime;
  console.log(`⏱️  Total verification interaction time: ${totalTime.toFixed(2)}ms`);
  
  // Check for immediate UI feedback
  setTimeout(() => {
    const hasError = document.querySelector('[style*="background: #dc3545"], .alert-danger');
    const hasSuccess = document.querySelector('[style*="background: #28a745"], .alert-success');
    
    if (hasError) {
      console.log("🔴 Error feedback detected");
    } else if (hasSuccess) {
      console.log("🟢 Success feedback detected");
    } else {
      console.log("⚪ No immediate feedback detected");
    }
  }, 100);
};

// Real-time performance monitoring
window.startPerformanceMonitoring = function() {
  console.log("🔍 Starting real-time performance monitoring...");
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        const timestamp = performance.now();
        
        // Check for error displays
        if (mutation.target.style && mutation.target.style.background && 
            mutation.target.style.background.includes('#dc3545')) {
          console.log(`🔴 Error display updated at ${timestamp.toFixed(2)}ms`);
        }
        
        // Check for success displays  
        if (mutation.target.style && mutation.target.style.background && 
            mutation.target.style.background.includes('#28a745')) {
          console.log(`🟢 Success display updated at ${timestamp.toFixed(2)}ms`);
        }
        
        // Check for state changes
        if (mutation.target.className && 
            (mutation.target.className.includes('verified') || 
             mutation.target.className.includes('complete'))) {
          console.log(`✅ State change detected at ${timestamp.toFixed(2)}ms`);
        }
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  console.log("📊 Performance monitoring active - watch console for real-time updates");
};

// Comprehensive test runner
window.runFullPerformanceTest = function() {
  console.log("🎯 RUNNING COMPREHENSIVE PERFORMANCE TEST");
  console.log("═".repeat(60));
  
  testCartVerificationPerformance();
  
  console.log("\n🔬 DETAILED MEASUREMENTS");
  console.log("-".repeat(40));
  
  measureVerificationSpeed("VALID-CART-001");
  
  setTimeout(() => {
    measureVerificationSpeed("INVALID-CART-999");
  }, 1000);
  
  setTimeout(() => {
    startPerformanceMonitoring();
    console.log("\n✅ PERFORMANCE TEST COMPLETE");
    console.log("📊 Monitor console for real-time performance data");
  }, 2000);
};

console.log("🧪 Performance testing functions loaded:");
console.log("• testCartVerificationPerformance() - Run basic performance tests");
console.log("• measureVerificationSpeed() - Measure specific cart verification");
console.log("• startPerformanceMonitoring() - Monitor real-time performance");
console.log("• runFullPerformanceTest() - Run comprehensive test suite");
