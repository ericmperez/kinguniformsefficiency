// Debug script to check timezone handling in segregation data
// Run this in browser console on the Production Classification Dashboard

console.log('🕐 TIMEZONE DEBUG FOR SEGREGATION DATA');
console.log('=====================================');

const now = new Date();
console.log('Current local time:', now.toString());
console.log('Current UTC time:', now.toISOString());
console.log('Current local date string (YYYY-MM-DD):', 
  now.getFullYear() + '-' + 
  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
  String(now.getDate()).padStart(2, '0')
);
console.log('Current UTC date string (YYYY-MM-DD):', now.toISOString().slice(0, 10));

// Check timezone offset
const timezoneOffset = now.getTimezoneOffset();
console.log('Timezone offset (minutes from UTC):', timezoneOffset);
console.log('Timezone offset (hours from UTC):', timezoneOffset / 60);

// If we have access to Firebase, check recent segregation records
if (window.firebase && window.firebase.firestore) {
  const db = window.firebase.firestore();
  
  console.log('\n📊 CHECKING SEGREGATION RECORD DATES...');
  
  db.collection('segregation_done_logs')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get()
    .then(snapshot => {
      console.log(`Found ${snapshot.docs.length} recent segregation records:`);
      
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const dateField = data.date;
        
        console.log(`\n  Record ${index + 1}:`);
        console.log(`    Client: ${data.clientName}`);
        console.log(`    Date field: "${dateField}"`);
        
        if (timestamp) {
          const timestampDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
          console.log(`    Timestamp: ${timestampDate.toString()}`);
          console.log(`    Timestamp UTC: ${timestampDate.toISOString()}`);
          
          // Check what date string would be generated from timestamp
          const localDateFromTimestamp = 
            timestampDate.getFullYear() + '-' + 
            String(timestampDate.getMonth() + 1).padStart(2, '0') + '-' + 
            String(timestampDate.getDate()).padStart(2, '0');
          const utcDateFromTimestamp = timestampDate.toISOString().slice(0, 10);
          
          console.log(`    Local date from timestamp: "${localDateFromTimestamp}"`);
          console.log(`    UTC date from timestamp: "${utcDateFromTimestamp}"`);
          console.log(`    Date field matches local: ${dateField === localDateFromTimestamp}`);
          console.log(`    Date field matches UTC: ${dateField === utcDateFromTimestamp}`);
        }
      });
      
      console.log('\n🎯 ANALYSIS:');
      console.log('If date fields match UTC dates, the system is using UTC for date filtering');
      console.log('If date fields match local dates, the system is using local time for date filtering');
      console.log('Current query is using UTC date:', now.toISOString().slice(0, 10));
      console.log('But if records are stored with local dates, they won\'t match!');
      
    })
    .catch(error => {
      console.error('Error checking segregation records:', error);
    });
    
} else {
  console.log('❌ Firebase not accessible - run this in browser console on the dashboard page');
}

console.log('\n💡 POTENTIAL SOLUTIONS:');
console.log('1. Use local date string instead of UTC date string for querying');
console.log('2. Query by timestamp range instead of date field');
console.log('3. Check both local and UTC date strings in the query');
