// Debug script to check segregation date filtering issue
// This should be run in the browser console on the Production Classification Dashboard page

console.log('🔍 SEGREGATION DATE FILTERING DEBUG');
console.log('Current date:', new Date().toISOString());
console.log('Today string (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
console.log('Yesterday string (YYYY-MM-DD):', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

// Check if we can access Firebase and query segregation data
if (window.firebase && window.firebase.firestore) {
  const db = window.firebase.firestore();
  
  console.log('\n📊 CHECKING RECENT SEGREGATION RECORDS...');
  
  // Query recent records (last 7 days)
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  db.collection('segregation_done_logs')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get()
    .then(snapshot => {
      console.log(`Found ${snapshot.docs.length} recent segregation records:`);
      
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const date = data.date;
        
        console.log(`\n  Record ${index + 1}:`);
        console.log(`    Client: ${data.clientName || 'Unknown'}`);
        console.log(`    Weight: ${data.weight || 0} lbs`);
        console.log(`    Date field: ${date}`);
        console.log(`    Timestamp: ${timestamp}`);
        
        if (timestamp) {
          const timestampDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
          console.log(`    Timestamp as date: ${timestampDate.toISOString()}`);
          console.log(`    Timestamp date string: ${timestampDate.toISOString().slice(0, 10)}`);
        }
      });
      
      // Check today's records specifically
      const todayStr = new Date().toISOString().slice(0, 10);
      console.log(`\n📅 CHECKING TODAY'S RECORDS (${todayStr})...`);
      
      return db.collection('segregation_done_logs')
        .where('date', '==', todayStr)
        .get();
    })
    .then(todaySnapshot => {
      console.log(`Found ${todaySnapshot.docs.length} records for today`);
      
      if (todaySnapshot.docs.length === 0) {
        console.log('⚠️ NO RECORDS FOUND FOR TODAY - This explains why segregation section is empty!');
        
        // Check yesterday
        const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        console.log(`\n📅 CHECKING YESTERDAY'S RECORDS (${yesterdayStr})...`);
        
        return db.collection('segregation_done_logs')
          .where('date', '==', yesterdayStr)
          .get();
      }
    })
    .then(yesterdaySnapshot => {
      if (yesterdaySnapshot) {
        console.log(`Found ${yesterdaySnapshot.docs.length} records for yesterday`);
        
        if (yesterdaySnapshot.docs.length > 0) {
          console.log('✅ FOUND YESTERDAY\'S RECORDS - Date filtering is the issue!');
          console.log('💡 SOLUTION: Update the query to include recent records or change date filtering logic');
        }
      }
    })
    .catch(error => {
      console.error('Error checking segregation records:', error);
    });
    
} else {
  console.log('❌ Firebase not accessible in browser context');
  console.log('Please run this script in the browser console on the dashboard page');
}

console.log('\n🎯 DIAGNOSIS:');
console.log('If no records are found for today but exist for yesterday,');
console.log('then the issue is that segregation data is filtered by date');
console.log('and only shows today\'s records, but today might not have any segregation activity yet.');
