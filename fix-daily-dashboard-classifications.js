// Fix for Daily Dashboard Classification Issues
// Run this in the browser console on the Daily Dashboard page

console.log('🔧 DAILY DASHBOARD CLASSIFICATION FIX');
console.log('===================================');

// Step 1: Clear any old localStorage data that might interfere
console.log('\n1️⃣ Clearing potential conflicting localStorage data...');
const oldData = localStorage.getItem('productClassifications');
if (oldData) {
  console.log('⚠️ Found old localStorage classifications, removing...');
  console.log('Old data:', JSON.parse(oldData));
  localStorage.removeItem('productClassifications');
  console.log('✅ Cleared old localStorage classifications');
} else {
  console.log('✅ No conflicting localStorage data found');
}

// Step 2: Verify current page
console.log('\n2️⃣ Verifying current page...');
const pageTitle = document.querySelector('h2')?.textContent || 'Unknown';
console.log(`📄 Current page: ${pageTitle}`);

if (!pageTitle.includes('Daily Employee Dashboard')) {
  console.log('⚠️ You need to be on the Daily Employee Dashboard');
  console.log('Navigate to: http://localhost:5173/daily-dashboard');
}

// Step 3: Check for production data
console.log('\n3️⃣ Checking production data display...');
const productionCards = document.querySelectorAll('.card');
console.log(`📊 Found ${productionCards.length} cards on dashboard`);

// Look for Mangle/Doblado data
const mangleData = document.querySelector('.text-success h3')?.textContent;
const dobladoData = document.querySelector('.text-warning h3')?.textContent;

if (mangleData && dobladoData) {
  console.log(`✅ Production data found:`);
  console.log(`   🟢 Mangle: ${mangleData}`);
  console.log(`   🟡 Doblado: ${dobladoData}`);
} else {
  console.log('⚠️ Production data not visible, checking for loading state...');
  const loadingSpinner = document.querySelector('.spinner-border');
  if (loadingSpinner) {
    console.log('⏳ Dashboard is still loading...');
  } else {
    console.log('❌ No production data or loading state found');
  }
}

// Step 4: Force refresh if needed
console.log('\n4️⃣ Refreshing page to ensure clean state...');
setTimeout(() => {
  console.log('🔄 Refreshing page in 3 seconds...');
  setTimeout(() => {
    window.location.reload();
  }, 3000);
}, 1000);

console.log('\n✅ Fix applied! The page will refresh to ensure clean state.');
console.log('After refresh, the Daily Dashboard should show correct Firebase classifications.');
