// Debug script to verify data consistency between dashboards
// Run this in browser console on the Daily Employee Dashboard page

console.log('🔍 DAILY EMPLOYEE DASHBOARD - DATA CONSISTENCY CHECK');
console.log('='.repeat(60));

// Check if window has the production summary
if (window.productionSummary) {
    const summary = window.productionSummary;
    console.log('📊 Production Summary Found:');
    console.log('Total Items Added:', summary.totalItemsAdded);
    console.log('All Entries Today Count:', summary.allEntriesToday?.length || 0);
    console.log('Recent Entries Count:', summary.recentEntries?.length || 0);
} else {
    console.log('❌ No production summary found on window object');
    console.log('Checking for React dev tools...');
    
    // Try to access via React DevTools if available
    if (window.React) {
        console.log('✅ React found, checking components...');
    }
}

// Check current data in localStorage
console.log('\n🗂️ CLASSIFICATION DATA:');
const customClassifications = JSON.parse(localStorage.getItem('productClassifications') || '{}');
console.log('Custom Classifications:', Object.keys(customClassifications).length, 'products');
console.log('Start Times:', {
    mangle: localStorage.getItem('mangleStartTime'),
    doblado: localStorage.getItem('dobladoStartTime'), 
    segregation: localStorage.getItem('segregationStartTime')
});

// Check if we can access Firebase data
console.log('\n🔥 FIREBASE DATA CHECK:');
if (window.db) {
    console.log('✅ Firebase database accessible');
    
    // Try to get today's invoice data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('📅 Checking date range:', today.toISOString(), 'to', tomorrow.toISOString());
} else {
    console.log('❌ Firebase not accessible from window');
}

console.log('\n💡 RECOMMENDATION:');
console.log('1. Ensure ProductionTrackingService is running');  
console.log('2. Check browser network tab for Firebase queries');
console.log('3. Verify classification logic consistency');
console.log('4. Compare with reference dashboard data source');
