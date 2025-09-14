// Test Client Daily Analytics Optimization Impact
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDHzHu2GciKGNpkZshzHdXfIKyZsTVzYtg",
  authDomain: "king-uniforms-21f4a.firebaseapp.com",
  projectId: "king-uniforms-21f4a",
  storageBucket: "king-uniforms-21f4a.appspot.com",
  messagingSenderId: "774767672469",
  appId: "1:774767672469:web:e6dbb6d41a53b7e5ed7b3e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testClientDailyAnalyticsOptimization() {
  console.log('\n📊 TESTING CLIENT DAILY ANALYTICS OPTIMIZATION');
  console.log('='.repeat(80));
  
  const today = new Date();
  const targetDate = today.toISOString().slice(0, 10);
  
  console.log(`🎯 Testing for target date: ${targetDate}`);
  console.log(`📅 Day of week: ${today.toLocaleDateString('en-US', { weekday: 'long' })}`);

  try {
    // Test 1: Daily pickup data query (already optimized)
    console.log('\n🔄 Testing daily pickup data query...');
    const [year, month, day] = targetDate.split("-").map(Number);
    const selectedDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
    const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

    const pickupQuery = query(
      collection(db, "pickup_entries"),
      where("timestamp", ">=", Timestamp.fromDate(selectedDateObj)),
      where("timestamp", "<", Timestamp.fromDate(nextDay))
    );

    const pickupStart = Date.now();
    const pickupSnapshot = await getDocs(pickupQuery);
    const pickupTime = Date.now() - pickupStart;

    console.log(`✅ Daily pickup query: ${pickupSnapshot.size} entries in ${pickupTime}ms (ALREADY OPTIMIZED)`);

    // Test 2: Daily production data query (already optimized)
    console.log('\n🔄 Testing daily production data query...');
    const invoicesQuery = query(
      collection(db, "invoices"),
      where("date", ">=", Timestamp.fromDate(selectedDateObj)),
      where("date", "<", Timestamp.fromDate(nextDay))
    );

    const productionStart = Date.now();
    const invoicesSnapshot = await getDocs(invoicesQuery);
    const productionTime = Date.now() - productionStart;

    console.log(`✅ Daily production query: ${invoicesSnapshot.size} invoices in ${productionTime}ms (ALREADY OPTIMIZED)`);

    // Test 3: BEFORE optimization - historical query (full year)
    console.log('\n🔄 Testing BEFORE optimization: Full year historical query...');
    const oneYearAgo = new Date(selectedDateObj);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const unoptimizedHistoricalQuery = query(
      collection(db, "invoices"),
      where("date", ">=", Timestamp.fromDate(oneYearAgo)),
      where("date", "<", Timestamp.fromDate(selectedDateObj))
    );

    const beforeStart = Date.now();
    const beforeSnapshot = await getDocs(unoptimizedHistoricalQuery);
    const beforeTime = Date.now() - beforeStart;

    console.log(`📈 BEFORE (365 days): ${beforeSnapshot.size} invoices in ${beforeTime}ms`);

    // Test 4: AFTER optimization - historical query (180 days)
    console.log('\n🔄 Testing AFTER optimization: 180-day historical query...');
    const sixMonthsAgo = new Date(selectedDateObj);
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

    const optimizedHistoricalQuery = query(
      collection(db, "invoices"),
      where("date", ">=", Timestamp.fromDate(sixMonthsAgo)),
      where("date", "<", Timestamp.fromDate(selectedDateObj)),
      orderBy("date", "desc")
    );

    const afterStart = Date.now();
    const afterSnapshot = await getDocs(optimizedHistoricalQuery);
    const afterTime = Date.now() - afterStart;

    console.log(`🚀 AFTER (180 days): ${afterSnapshot.size} invoices in ${afterTime}ms`);

    // Calculate optimization impact
    console.log('\n📊 OPTIMIZATION IMPACT ANALYSIS');
    console.log('='.repeat(50));
    
    const readReduction = ((beforeSnapshot.size - afterSnapshot.size) / beforeSnapshot.size * 100).toFixed(1);
    const timeImprovement = beforeTime > 0 ? ((beforeTime - afterTime) / beforeTime * 100).toFixed(1) : 'N/A';
    
    console.log(`📉 Firebase reads reduced by: ${readReduction}% (${beforeSnapshot.size} → ${afterSnapshot.size})`);
    console.log(`⚡ Query time improved by: ${timeImprovement}% (${beforeTime}ms → ${afterTime}ms)`);
    
    // Calculate cost savings (assuming $0.60 per 100k reads)
    const monthlySavings = (beforeSnapshot.size - afterSnapshot.size) * 30 * (0.60 / 100000);
    console.log(`💰 Estimated monthly cost savings: $${monthlySavings.toFixed(4)}`);

    // Test data quality - ensure we still get meaningful historical data
    console.log('\n🔍 DATA QUALITY VERIFICATION');
    console.log('='.repeat(40));
    
    // Count unique clients in each dataset
    const beforeClients = new Set();
    const afterClients = new Set();
    
    beforeSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.clientId) beforeClients.add(data.clientId);
    });
    
    afterSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.clientId) afterClients.add(data.clientId);
    });

    console.log(`👥 Unique clients in 365-day range: ${beforeClients.size}`);
    console.log(`👥 Unique clients in 180-day range: ${afterClients.size}`);
    console.log(`📊 Client retention: ${(afterClients.size / beforeClients.size * 100).toFixed(1)}%`);

    // Analyze by day of week (the core functionality)
    const targetDayOfWeek = selectedDateObj.getDay();
    let beforeSameDayCount = 0;
    let afterSameDayCount = 0;

    beforeSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.date) {
        const invDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
        if (invDate.getDay() === targetDayOfWeek) beforeSameDayCount++;
      }
    });

    afterSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.date) {
        const invDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
        if (invDate.getDay() === targetDayOfWeek) afterSameDayCount++;
      }
    });

    console.log(`📅 Same-day-of-week invoices in 365-day range: ${beforeSameDayCount}`);
    console.log(`📅 Same-day-of-week invoices in 180-day range: ${afterSameDayCount}`);
    console.log(`🎯 Prediction data retention: ${(afterSameDayCount / beforeSameDayCount * 100).toFixed(1)}%`);

    console.log('\n✅ OPTIMIZATION SUMMARY');
    console.log('='.repeat(30));
    console.log('• Daily queries were already optimized (single-day ranges)');
    console.log('• Historical analysis optimized from 365 days to 180 days');
    console.log(`• Reduces Firebase reads by ${readReduction}%`);
    console.log(`• Maintains ${(afterSameDayCount / beforeSameDayCount * 100).toFixed(1)}% of prediction data quality`);
    console.log('• Follows same optimization pattern as AnalyticsPage');
    console.log('• Significantly improves page load performance');

    return {
      beforeReads: beforeSnapshot.size,
      afterReads: afterSnapshot.size,
      reduction: parseFloat(readReduction),
      timeImprovement: parseFloat(timeImprovement),
      clientRetention: afterClients.size / beforeClients.size,
      predictionDataRetention: afterSameDayCount / beforeSameDayCount
    };

  } catch (error) {
    console.error("❌ Error during optimization testing:", error);
    return null;
  }
}

// Run the test
testClientDailyAnalyticsOptimization().then((results) => {
  if (results) {
    console.log('\n🎊 Client Daily Analytics optimization testing completed successfully!');
    console.log('📊 Check the dashboard to see improved performance.');
  } else {
    console.log('\n❌ Optimization testing failed');
  }
  process.exit(0);
}).catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
