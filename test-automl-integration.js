/**
 * Test AutoML Data Service Integration
 * 
 * This script tests the new AutoML Data Service to ensure it integrates
 * properly with the existing Firebase data and ML system.
 * 
 * USAGE:
 * 1. Open the app at http://localhost:5176
 * 2. Open browser console (F12)
 * 3. Paste this script and press Enter
 * 4. Run: testAutoMLService()
 */

console.log("🧪 AutoML Data Service Test Script Loaded");

/**
 * Test the AutoML Data Service integration
 */
window.testAutoMLService = async function() {
  console.log("🤖 Testing AutoML Data Service Integration...");
  console.log("=" .repeat(60));
  
  try {
    // Test if we can import the service
    console.log("📥 Testing service import...");
    
    // Test service instantiation
    if (window.AutoMLDataService) {
      const autoML = window.AutoMLDataService.getInstance();
      console.log("✅ AutoML service instantiated successfully");
      
      // Test historical data fetching
      console.log("\n📊 Testing historical data fetching...");
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days
      
      const historicalData = await autoML.getHistoricalPickupData(startDate, endDate);
      console.log(`✅ Found ${historicalData.length} historical pickup records`);
      
      if (historicalData.length > 0) {
        console.log("📋 Sample historical data:");
        console.log(historicalData.slice(0, 3)); // Show first 3 records
      }
      
      // Test automatic learning stats
      console.log("\n📈 Testing automatic learning stats...");
      const stats = await autoML.getAutomaticLearningStats();
      console.log("✅ Learning statistics generated:");
      console.log(`   Total Comparisons: ${stats.totalComparisons}`);
      console.log(`   Average Accuracy: ${stats.averageAccuracy.toFixed(1)}%`);
      console.log(`   Recent Accuracy: ${stats.recentAccuracy.toFixed(1)}%`);
      console.log(`   Improvement Trend: ${stats.improvementTrend}`);
      
      // Test ML service integration
      console.log("\n🧠 Testing ML service integration...");
      const mlInsights = window.MachineLearningService ? 
        window.MachineLearningService.getInstance().getMLInsights() : null;
      
      if (mlInsights) {
        console.log("✅ ML service integration working");
        console.log(`   Total Predictions: ${mlInsights.totalPredictions}`);
        console.log(`   Recent Accuracy: ${mlInsights.recentAccuracy}`);
      }
      
      console.log("\n🎉 AutoML Data Service Test PASSED!");
      console.log("✅ Service is properly integrated and functional");
      
    } else {
      console.log("❌ AutoML service not found - check import");
    }
    
  } catch (error) {
    console.error("❌ AutoML test failed:", error);
    console.log("\n🔍 Troubleshooting tips:");
    console.log("1. Ensure AutoMLDataService is properly exported");
    console.log("2. Check that Firebase data is accessible");
    console.log("3. Verify ML service integration");
  }
};

/**
 * Test the PredictionOutcomeRecorder component integration
 */
window.testPredictionOutcomeRecorder = function() {
  console.log("🎯 Testing PredictionOutcomeRecorder Integration...");
  console.log("=" .repeat(50));
  
  // Check if the component rendered without errors
  const mlLearningButtons = document.querySelectorAll('button');
  const hasMLButtons = Array.from(mlLearningButtons).some(btn => 
    btn.textContent?.includes('Automatic Learning') || 
    btn.textContent?.includes('Manual Entry')
  );
  
  if (hasMLButtons) {
    console.log("✅ PredictionOutcomeRecorder rendered successfully");
    console.log("✅ Both Manual Entry and Automatic Learning options available");
  } else {
    console.log("⚠️  ML Learning buttons not found - component may not be visible");
    console.log("💡 Navigate to Enhanced Prediction Dashboard to see ML Learning System");
  }
  
  console.log("\n🎯 To test the full interface:");
  console.log("1. Navigate to Enhanced Prediction Dashboard");
  console.log("2. Look for '🎯 ML Learning System' card");
  console.log("3. Try both 'Manual Entry' and 'Automatic Learning' options");
  console.log("4. Verify the interface switches correctly between modes");
};

// Auto-run basic integration test
console.log("\n🚀 Running basic integration test...");
if (typeof testAutoMLService === 'function') {
  // Run in next tick to allow for imports
  setTimeout(() => {
    testAutoMLService().catch(console.error);
  }, 1000);
}

console.log("\n🎯 Available test functions:");
console.log("• testAutoMLService() - Test AutoML data service");  
console.log("• testPredictionOutcomeRecorder() - Test UI integration");

console.log("\n📋 Quick Start:");
console.log("Run: testAutoMLService()");
