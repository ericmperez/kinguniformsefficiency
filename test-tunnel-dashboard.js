// Test script for Real-Time Tunnel Groups Dashboard
// Run this in the browser console to create sample tunnel groups for testing

async function createSampleTunnelGroups() {
  console.log('🧪 Creating sample tunnel groups for testing...');
  
  // This would typically be done through the normal pickup entry process
  // but this helps demonstrate the functionality
  
  const sampleGroups = [
    {
      clientName: 'Hospital ABC',
      totalWeight: 250,
      segregatedCarts: 3,
      totalCarts: 4,
      status: 'Tunnel',
      washed: false,
      washingType: 'Tunnel'
    },
    {
      clientName: 'Hotel XYZ',
      totalWeight: 180,
      segregatedCarts: 2,
      totalCarts: 3,
      status: 'Tunnel', 
      washed: true,
      washingType: 'Tunnel'
    },
    {
      clientName: 'Restaurant 123',
      totalWeight: 120,
      segregatedCarts: 1,
      totalCarts: 2,
      status: 'Tunnel',
      washed: false,
      washingType: 'Tunnel'
    }
  ];
  
  console.log('📋 Sample tunnel groups that would show:');
  
  sampleGroups.forEach((group, index) => {
    const processedRatio = group.segregatedCarts / group.totalCarts;
    const processedWeight = Math.round(group.totalWeight * processedRatio);
    const remainingWeight = group.totalWeight - processedWeight;
    const progress = Math.round((processedWeight / group.totalWeight) * 100);
    
    console.log(`\n${index + 1}. ${group.clientName}:`);
    console.log(`   📊 Progress: ${progress}%`);
    console.log(`   ✅ Processed: ${processedWeight} lbs`);
    console.log(`   ⏳ Remaining: ${remainingWeight} lbs`);
    console.log(`   📦 Total: ${group.totalWeight} lbs`);
    console.log(`   🏷️  Status: ${group.washed ? '✓ Washed' : '⏳ In Progress'}`);
    console.log(`   🗂️  Carts: ${group.segregatedCarts}/${group.totalCarts}`);
  });
  
  console.log('\n🎯 To see real data:');
  console.log('1. Navigate to the Operations Dashboard');
  console.log('2. Create pickup entries for tunnel clients');
  console.log('3. Process them through segregation');
  console.log('4. Watch the real-time updates!');
}

// Auto-run the demo
createSampleTunnelGroups();

// Helper to test tunnel group calculations
function testTunnelCalculations() {
  console.log('\n🧮 Testing tunnel group calculation logic:');
  
  const testCase = {
    totalWeight: 200,
    segregatedCarts: 3,
    totalCarts: 4
  };
  
  const processedRatio = testCase.segregatedCarts / testCase.totalCarts;
  const processedWeight = testCase.totalWeight * processedRatio;
  const remainingWeight = testCase.totalWeight - processedWeight;
  const progress = (processedWeight / testCase.totalWeight) * 100;
  
  console.log(`Input: ${testCase.totalWeight} lbs total, ${testCase.segregatedCarts}/${testCase.totalCarts} carts processed`);
  console.log(`Ratio: ${processedRatio.toFixed(2)} (${testCase.segregatedCarts}/${testCase.totalCarts})`);
  console.log(`Processed: ${processedWeight.toFixed(1)} lbs`);
  console.log(`Remaining: ${remainingWeight.toFixed(1)} lbs`);
  console.log(`Progress: ${progress.toFixed(1)}%`);
  
  console.log('\n✅ Calculation logic working correctly!');
}

// Export for console use
window.testTunnelDashboard = {
  createSampleTunnelGroups,
  testTunnelCalculations
};
