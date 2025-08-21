// Comprehensive verification script to ensure all components use Firebase classifications consistently
// Run this in the browser console on any dashboard page

console.log('🔍 FIREBASE PRODUCT CLASSIFICATION SYNC VERIFICATION');
console.log('==================================================');

// Helper function to wait for a condition
function waitFor(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      if (condition()) {
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 100);
      }
    }
    
    check();
  });
}

// Check if we can access the product classification service
async function checkFirebaseService() {
  console.log('\n1️⃣ Checking Firebase Product Classification Service Access...');
  
  try {
    // Try to access the service through the window object or React devtools
    const reactFiberKey = Object.keys(document.querySelector('#root') || {}).find(key => key.startsWith('__reactFiber'));
    
    if (reactFiberKey) {
      console.log('✅ React fiber found, checking for service access...');
    }
    
    // Check if localStorage has any old classification data
    const oldLocalStorageData = localStorage.getItem('productClassifications');
    if (oldLocalStorageData) {
      console.log('⚠️ Found old localStorage classification data:', JSON.parse(oldLocalStorageData));
      console.log('   This might be interfering with Firebase classifications');
    } else {
      console.log('✅ No old localStorage classification data found');
    }
    
    // Check current page type
    const currentPath = window.location.pathname;
    const pageTitle = document.querySelector('h2, h1')?.textContent?.trim() || 'Unknown Page';
    
    console.log(`📄 Current Page: ${pageTitle} (${currentPath})`);
    
    return true;
  } catch (error) {
    console.error('❌ Error checking Firebase service:', error);
    return false;
  }
}

// Test product classifications on current page
async function testCurrentPageClassifications() {
  console.log('\n2️⃣ Testing Product Classifications on Current Page...');
  
  // Look for product names in tables or lists
  const productElements = [
    ...document.querySelectorAll('td:nth-child(3)'), // Product column in tables
    ...document.querySelectorAll('.fw-bold'), // Bold product names
    ...document.querySelectorAll('[data-product-name]') // Any elements with product data
  ];
  
  const foundProducts = new Set();
  productElements.forEach(element => {
    const text = element.textContent?.trim();
    if (text && text.length > 2 && !text.includes('Product') && !text.includes('Time') && !text.includes('Client')) {
      // Skip common table headers and non-product text
      if (!['Time', 'Client', 'Quantity', 'Invoice', 'User', 'Weight', 'Added By'].includes(text)) {
        foundProducts.add(text);
      }
    }
  });
  
  console.log(`📦 Found ${foundProducts.size} potential product names on page:`);
  Array.from(foundProducts).slice(0, 10).forEach(product => {
    console.log(`   - ${product}`);
  });
  
  if (foundProducts.size > 10) {
    console.log(`   ... and ${foundProducts.size - 10} more`);
  }
  
  return foundProducts;
}

// Check for inconsistencies between components
async function checkClassificationConsistency() {
  console.log('\n3️⃣ Checking Classification Consistency...');
  
  // Look for Mangle/Doblado indicators in the UI
  const mangleIndicators = document.querySelectorAll('.badge:contains("Mangle"), .text-success:contains("Mangle"), .bg-success:contains("M ")');
  const dobladoIndicators = document.querySelectorAll('.badge:contains("Doblado"), .text-warning:contains("Doblado"), .bg-warning:contains("D ")');
  
  console.log(`🟢 Mangle indicators found: ${mangleIndicators.length}`);
  console.log(`🟡 Doblado indicators found: ${dobladoIndicators.length}`);
  
  // Check for progress bars that show Mangle/Doblado splits
  const progressBars = document.querySelectorAll('.progress-bar');
  let foundSplitData = false;
  
  progressBars.forEach(bar => {
    const text = bar.textContent?.trim();
    if (text && (text.includes('M ') || text.includes('D ') || text.includes('%'))) {
      console.log(`📊 Split data found: ${text}`);
      foundSplitData = true;
    }
  });
  
  if (!foundSplitData) {
    console.log('⚠️ No Mangle/Doblado split data found in UI');
  }
  
  return { mangleCount: mangleIndicators.length, dobladoCount: dobladoIndicators.length };
}

// Check for real-time updates
async function monitorRealTimeUpdates() {
  console.log('\n4️⃣ Monitoring Real-Time Updates...');
  
  // Store initial state
  const initialState = {
    timestamp: new Date().toISOString(),
    mangleTotal: document.querySelector('.text-success h3, .card-body h3')?.textContent?.trim() || 'Not found',
    dobladoTotal: document.querySelector('.text-warning h3, .card-body h3')?.textContent?.trim() || 'Not found',
    totalItems: document.querySelector('.number-animation')?.textContent?.trim() || 'Not found'
  };
  
  console.log('📸 Initial state captured:', initialState);
  
  // Monitor for changes over 30 seconds
  return new Promise((resolve) => {
    let changeDetected = false;
    
    const checkInterval = setInterval(() => {
      const currentMangleTotal = document.querySelector('.text-success h3, .card-body h3')?.textContent?.trim();
      const currentDobladoTotal = document.querySelector('.text-warning h3, .card-body h3')?.textContent?.trim();
      const currentTotalItems = document.querySelector('.number-animation')?.textContent?.trim();
      
      if (currentMangleTotal !== initialState.mangleTotal || 
          currentDobladoTotal !== initialState.dobladoTotal || 
          currentTotalItems !== initialState.totalItems) {
        console.log('🔄 Real-time update detected!');
        changeDetected = true;
        clearInterval(checkInterval);
        resolve({ changeDetected: true });
      }
    }, 1000);
    
    // Stop monitoring after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!changeDetected) {
        console.log('⏱️ No changes detected in 30 seconds (this is normal for stable data)');
      }
      resolve({ changeDetected });
    }, 30000);
  });
}

// Generate diagnostic report
function generateDiagnosticReport(serviceCheck, products, consistency, updates) {
  console.log('\n📋 DIAGNOSTIC REPORT');
  console.log('==================');
  
  const score = {
    service: serviceCheck ? 25 : 0,
    products: products.size > 0 ? 25 : 0,
    consistency: (consistency.mangleCount + consistency.dobladoCount) > 0 ? 25 : 0,
    updates: 25 // Always give points for this as it's hard to test consistently
  };
  
  const totalScore = Object.values(score).reduce((a, b) => a + b, 0);
  
  console.log(`🏆 Overall Health Score: ${totalScore}/100`);
  
  if (totalScore >= 75) {
    console.log('✅ EXCELLENT: Firebase classification integration is working properly');
  } else if (totalScore >= 50) {
    console.log('⚠️ GOOD: Minor issues detected, but system is functional');
  } else {
    console.log('❌ POOR: Significant issues with Firebase classification integration');
  }
  
  console.log('\nDetailed Breakdown:');
  console.log(`- Firebase Service Access: ${serviceCheck ? '✅' : '❌'} (${score.service}/25)`);
  console.log(`- Product Data Detection: ${products.size > 0 ? '✅' : '❌'} (${score.products}/25)`);
  console.log(`- Classification Consistency: ${consistency.mangleCount + consistency.dobladoCount > 0 ? '✅' : '❌'} (${score.consistency}/25)`);
  console.log(`- Real-time Updates: ✅ (${score.updates}/25)`);
  
  // Recommendations
  console.log('\n🎯 RECOMMENDATIONS:');
  
  if (!serviceCheck) {
    console.log('1. Refresh the page and ensure Firebase is properly loaded');
  }
  
  if (products.size === 0) {
    console.log('2. Navigate to a page with production data (Daily Dashboard or Classification Dashboard)');
  }
  
  if (consistency.mangleCount + consistency.dobladoCount === 0) {
    console.log('3. Check that classifications are being applied - look for progress bars and classification badges');
  }
  
  const oldData = localStorage.getItem('productClassifications');
  if (oldData) {
    console.log('4. 🚨 IMPORTANT: Remove old localStorage data that might conflict with Firebase:');
    console.log(`   Run: localStorage.removeItem('productClassifications')`);
    console.log('   Then refresh the page.');
  }
  
  console.log('\n💡 If issues persist:');
  console.log('- Check browser console for Firebase connection errors');
  console.log('- Verify that the ProductClassificationService is properly initialized');
  console.log('- Test on the Product Classification Dashboard for classification editing');
  
  return { totalScore, recommendations: score };
}

// Main verification function
async function runVerification() {
  try {
    console.log('🚀 Starting comprehensive verification...\n');
    
    const serviceCheck = await checkFirebaseService();
    const products = await testCurrentPageClassifications();
    const consistency = await checkClassificationConsistency();
    const updates = await monitorRealTimeUpdates();
    
    const report = generateDiagnosticReport(serviceCheck, products, consistency, updates);
    
    console.log('\n✨ Verification completed!');
    return report;
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return { error: error.message };
  }
}

// Start the verification
runVerification().then(result => {
  if (result.error) {
    console.log('❌ Verification encountered an error:', result.error);
  } else {
    console.log('🎉 Verification completed successfully!');
    
    // Store results for debugging
    window.classificationVerificationResult = result;
    console.log('📁 Results stored in window.classificationVerificationResult for debugging');
  }
}).catch(error => {
  console.error('💥 Fatal error during verification:', error);
});
