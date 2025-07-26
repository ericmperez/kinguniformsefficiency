/**
 * Real-time Cart Name Change Monitor
 * 
 * This script monitors cart name changes in real-time and provides detailed logging
 * about the state management and synchronization process.
 */

console.log("🔍 Real-time Cart Monitor loaded");

// Global monitoring state
window.cartMonitor = {
  observer: null,
  cartStates: new Map(),
  changeCount: 0,
  isActive: false
};

/**
 * Start monitoring cart name changes
 */
window.startCartMonitoring = function() {
  if (window.cartMonitor.isActive) {
    console.log("⚠️  Monitoring already active");
    return;
  }
  
  console.log("🔍 Starting real-time cart monitoring...");
  
  // Initialize cart states
  updateCartStates();
  
  // Create mutation observer
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const target = mutation.target;
        
        // Check if this affects a cart name element
        if (isCartNameElement(target) || hasCartNameChild(target)) {
          handleCartNameChange(mutation);
        }
      }
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false
  });
  
  window.cartMonitor.observer = observer;
  window.cartMonitor.isActive = true;
  
  console.log("✅ Cart monitoring started");
  console.log("📊 Current cart states:", Array.from(window.cartMonitor.cartStates.entries()));
};

/**
 * Stop monitoring
 */
window.stopCartMonitoring = function() {
  if (!window.cartMonitor.isActive) {
    console.log("⚠️  Monitoring not active");
    return;
  }
  
  if (window.cartMonitor.observer) {
    window.cartMonitor.observer.disconnect();
    window.cartMonitor.observer = null;
  }
  
  window.cartMonitor.isActive = false;
  console.log("🛑 Cart monitoring stopped");
};

/**
 * Update the stored cart states
 */
function updateCartStates() {
  const cartSections = document.querySelectorAll('.cart-section');
  
  cartSections.forEach((section, index) => {
    const nameElement = section.querySelector('h3');
    if (nameElement) {
      const cartName = nameElement.textContent.replace(/\(r:\d+\)/, '').trim();
      const cartId = section.getAttribute('key') || `cart-${index}`;
      
      const previousState = window.cartMonitor.cartStates.get(cartId);
      const currentState = {
        id: cartId,
        name: cartName,
        element: nameElement,
        section: section,
        timestamp: Date.now()
      };
      
      window.cartMonitor.cartStates.set(cartId, currentState);
      
      // Log changes
      if (previousState && previousState.name !== cartName) {
        console.log(`🔄 Cart name changed: "${previousState.name}" → "${cartName}"`);
        window.cartMonitor.changeCount++;
      }
    }
  });
}

/**
 * Handle cart name changes
 */
function handleCartNameChange(mutation) {
  console.log("🔍 Detected cart name mutation:", {
    type: mutation.type,
    target: mutation.target,
    timestamp: new Date().toISOString()
  });
  
  // Update states and detect changes
  setTimeout(() => {
    updateCartStates();
  }, 10);
}

/**
 * Check if element is a cart name element
 */
function isCartNameElement(element) {
  return element.tagName === 'H3' && 
         element.closest('.cart-section') !== null;
}

/**
 * Check if element has cart name children
 */
function hasCartNameChild(element) {
  return element.querySelector && 
         element.querySelector('.cart-section h3') !== null;
}

/**
 * Get current monitoring status
 */
window.getCartMonitorStatus = function() {
  console.log("📊 Cart Monitor Status:");
  console.log(`• Active: ${window.cartMonitor.isActive}`);
  console.log(`• Changes detected: ${window.cartMonitor.changeCount}`);
  console.log(`• Tracked carts: ${window.cartMonitor.cartStates.size}`);
  
  if (window.cartMonitor.cartStates.size > 0) {
    console.log("📋 Current cart states:");
    Array.from(window.cartMonitor.cartStates.entries()).forEach(([id, state]) => {
      console.log(`  • ${id}: "${state.name}"`);
    });
  }
};

/**
 * Test cart name persistence manually
 */
window.testCartPersistence = function(cartIndex = 0) {
  const cartSections = Array.from(document.querySelectorAll('.cart-section'));
  
  if (cartIndex >= cartSections.length) {
    console.log(`❌ Cart index ${cartIndex} not found. Available: 0-${cartSections.length - 1}`);
    return;
  }
  
  const section = cartSections[cartIndex];
  const nameElement = section.querySelector('h3');
  const editButton = section.querySelector('button[title="Edit Cart Name"]');
  
  if (!nameElement || !editButton) {
    console.log("❌ Could not find name element or edit button");
    return;
  }
  
  const originalName = nameElement.textContent.replace(/\(r:\d+\)/, '').trim();
  const testName = `PERSIST_TEST_${Date.now()}`;
  
  console.log(`🧪 Testing persistence for cart "${originalName}"`);
  console.log(`📝 Will rename to: "${testName}"`);
  
  // Override prompt
  const originalPrompt = window.prompt;
  window.prompt = () => testName;
  
  // Start monitoring this specific change
  const startTime = Date.now();
  const checkPersistence = setInterval(() => {
    const currentName = nameElement.textContent.replace(/\(r:\d+\)/, '').trim();
    const elapsed = Date.now() - startTime;
    
    if (currentName === testName) {
      clearInterval(checkPersistence);
      console.log(`✅ SUCCESS: Cart name persisted after ${elapsed}ms`);
    } else if (elapsed > 5000) {
      clearInterval(checkPersistence);
      console.log(`❌ TIMEOUT: Cart name did not persist after 5s. Current: "${currentName}"`);
    }
  }, 100);
  
  // Click edit button
  editButton.click();
  
  // Restore prompt
  setTimeout(() => {
    window.prompt = originalPrompt;
  }, 1000);
};

// Auto-start monitoring when script loads
setTimeout(() => {
  if (document.querySelector('.cart-section')) {
    window.startCartMonitoring();
    console.log("🎯 Functions available:");
    console.log("• startCartMonitoring() - Start monitoring");
    console.log("• stopCartMonitoring() - Stop monitoring");  
    console.log("• getCartMonitorStatus() - Check status");
    console.log("• testCartPersistence(index) - Test specific cart");
  } else {
    console.log("⚠️  No cart sections found. Open an invoice modal first.");
  }
}, 1000);
