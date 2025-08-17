// Debug script to extract detailed data from console
// Run this in the browser console to get structured data

console.clear();
console.log('🔍 Extracting detailed data from recent logs...');

// This will help us understand the data distribution
setTimeout(() => {
  console.log('If you can see this, copy the structured log data from above and analyze:');
  console.log('1. hourlyBreakdownData - shows which hours have units');
  console.log('2. recentEntriesHours - shows which hours the recent 50 entries come from');
  console.log('3. hourlyStats - shows the computed breakdown per hour');
  
  // Instructions for manual analysis
  console.log('Look for mismatches between:');
  console.log('- Hours in hourlyBreakdownData (service data)');
  console.log('- Hours in recentEntriesHours (entry distribution)');
  console.log('- Hours in hourlyStats (computed from entries)');
  
}, 1000);
