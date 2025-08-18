// Demo: End-of-Shift Detection Using Last Item Timestamps
// This demonstrates how production end time is determined by the actual last item processed

console.log('🏁 END-OF-SHIFT DETECTION - LAST ITEM TIMESTAMP APPROACH');
console.log('========================================================');

// Simulated current time
const now = new Date();
console.log(`\n📅 Current Time: ${now.toLocaleString()}`);

// Simulated production groups with their actual last item timestamps
const productionGroups = [
  {
    name: 'Mangle Team',
    firstItemTime: new Date(now.getTime() - 8 * 60 * 60 * 1000), // Started 8 hours ago
    lastItemTime: new Date(now.getTime() - 10 * 60 * 1000), // Last item 10 minutes ago
    itemCount: 145,
    description: 'Last processed sheet at 10 minutes ago - production ended there'
  },
  {
    name: 'Doblado Team', 
    firstItemTime: new Date(now.getTime() - 9 * 60 * 60 * 1000), // Started 9 hours ago
    lastItemTime: new Date(now.getTime() - 25 * 60 * 1000), // Last item 25 minutes ago
    itemCount: 89,
    description: 'Last folded uniform 25 minutes ago - clearly finished'
  },
  {
    name: 'General Production',
    firstItemTime: new Date(now.getTime() - 6 * 60 * 60 * 1000), // Started 6 hours ago
    lastItemTime: new Date(now.getTime() - 50 * 60 * 1000), // Last item 50 minutes ago
    itemCount: 67,
    description: 'Last item processed 50 minutes ago - production definitely ended'
  }
];

// Detection thresholds (same as in ShiftEndDetectionService.ts)
const WINDING_DOWN_THRESHOLD = 15; // minutes
const IDLE_THRESHOLD = 30; // minutes  

console.log('\n🔧 Detection Logic:');
console.log(`   Production End Time = Last Item Timestamp`);
console.log(`   Active: Last item within ${WINDING_DOWN_THRESHOLD} minutes`);
console.log(`   Winding Down: Last item ${WINDING_DOWN_THRESHOLD}-${IDLE_THRESHOLD} minutes ago`);
console.log(`   Finished: Last item ${IDLE_THRESHOLD}+ minutes ago`);

console.log('\n📊 Production Group Analysis:');
console.log('==============================');

let overallLatestItemTime = new Date(0); // Track the latest item across all groups

productionGroups.forEach(group => {
  const productionSpanMs = group.lastItemTime.getTime() - group.firstItemTime.getTime();
  const productionSpanHours = productionSpanMs / (1000 * 60 * 60);
  const itemsPerHour = group.itemCount / productionSpanHours;
  
  const minutesSinceLastItem = Math.floor((now.getTime() - group.lastItemTime.getTime()) / (1000 * 60));
  
  // Update overall latest item time
  if (group.lastItemTime > overallLatestItemTime) {
    overallLatestItemTime = group.lastItemTime;
  }
  
  let status, statusIcon, interpretation;
  
  if (minutesSinceLastItem <= WINDING_DOWN_THRESHOLD) {
    status = 'ACTIVE';
    statusIcon = '🟢';
    interpretation = 'Production may still be ongoing';
  } else if (minutesSinceLastItem <= IDLE_THRESHOLD) {
    status = 'WINDING DOWN'; 
    statusIcon = '🟡';
    interpretation = 'Production ended, possibly cleaning up';
  } else {
    status = 'FINISHED';
    statusIcon = '🔴';
    interpretation = 'Production clearly ended at last item time';
  }
  
  console.log(`\n${statusIcon} ${group.name}`);
  console.log(`   Status: ${status}`);
  console.log(`   First Item: ${group.firstItemTime.toLocaleTimeString()}`);
  console.log(`   Last Item: ${group.lastItemTime.toLocaleTimeString()} (Production END)`);
  console.log(`   Production Span: ${productionSpanHours.toFixed(1)} hours`);
  console.log(`   Items Processed: ${group.itemCount} (${itemsPerHour.toFixed(1)}/hour)`);
  console.log(`   Time Since End: ${minutesSinceLastItem} minutes`);
  console.log(`   Interpretation: ${interpretation}`);
});

// Overall analysis using the latest item time across all groups
console.log('\n🎯 Overall Production Analysis:');
console.log('===============================');

const minutesSinceOverallLastItem = Math.floor((now.getTime() - overallLatestItemTime.getTime()) / (1000 * 60));

console.log(`Overall Production End Time: ${overallLatestItemTime.toLocaleTimeString()}`);
console.log(`Time Since Last Item (Any Group): ${minutesSinceOverallLastItem} minutes`);
console.log(`Latest Item Determines Overall Status: Based on most recent activity`);

// Categorize groups based on their individual last item times
const activeGroups = productionGroups.filter(g => {
  const minutes = Math.floor((now.getTime() - g.lastItemTime.getTime()) / (1000 * 60));
  return minutes <= WINDING_DOWN_THRESHOLD;
});

const windingDownGroups = productionGroups.filter(g => {
  const minutes = Math.floor((now.getTime() - g.lastItemTime.getTime()) / (1000 * 60));
  return minutes > WINDING_DOWN_THRESHOLD && minutes <= IDLE_THRESHOLD;
});

const finishedGroups = productionGroups.filter(g => {
  const minutes = Math.floor((now.getTime() - g.lastItemTime.getTime()) / (1000 * 60));
  return minutes > IDLE_THRESHOLD;
});

let overallStatus;
if (activeGroups.length > 0) {
  overallStatus = 'ACTIVE';
} else if (windingDownGroups.length > 0) {
  overallStatus = 'WINDING DOWN';
} else {
  overallStatus = 'FINISHED';
}

console.log(`\nOverall Status: ${overallStatus}`);
console.log(`Active Groups: ${activeGroups.length} (${activeGroups.map(g => g.name).join(', ')})`);
console.log(`Winding Down Groups: ${windingDownGroups.length} (${windingDownGroups.map(g => g.name).join(', ')})`);
console.log(`Finished Groups: ${finishedGroups.length} (${finishedGroups.map(g => g.name).join(', ')})`);

// Production timeline analysis
console.log('\n📈 Production Timeline (End Times):');
console.log('====================================');

const groupsByEndTime = [...productionGroups].sort((a, b) => a.lastItemTime.getTime() - b.lastItemTime.getTime());

groupsByEndTime.forEach((group, index) => {
  const isLatest = group.lastItemTime.getTime() === overallLatestItemTime.getTime();
  console.log(`${index + 1}. ${group.name}: ${group.lastItemTime.toLocaleTimeString()}${isLatest ? ' ← Latest Overall' : ''}`);
});

// Key benefits of this approach
console.log('\n✅ BENEFITS OF LAST ITEM TIMESTAMP APPROACH:');
console.log('=============================================');
console.log('🎯 Precision: Uses exact timestamp when last item was processed');
console.log('📊 Accuracy: No estimation - production ended when last item was added');
console.log('📋 Traceability: Can track back to specific items and invoices');
console.log('⚡ Real-time: Updates immediately when items are processed');
console.log('🔍 Clarity: Clear correlation between item activity and production status');
console.log('📈 Analytics: Provides exact production span and rates');

console.log('\n💡 DASHBOARD DISPLAY EXAMPLE:');
console.log('=============================');
console.log(`📦 Last Item Processed: ${overallLatestItemTime.toLocaleTimeString()}`);
console.log(`⏱️ Time Since Last Item: ${minutesSinceOverallLastItem} minutes ago`);
console.log(`🎯 Production Status: ${overallStatus}`);
console.log(`📊 Group Breakdown:`);
activeGroups.forEach(g => console.log(`   🟢 ${g.name} - Active`));
windingDownGroups.forEach(g => console.log(`   🟡 ${g.name} - Winding Down`));
finishedGroups.forEach(g => console.log(`   🔴 ${g.name} - Finished`));

console.log('\n✅ DEMO COMPLETE! This approach provides the most accurate production end detection.');
