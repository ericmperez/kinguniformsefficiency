import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

// Firebase config - same as the app
const firebaseConfig = {
  apiKey: "AIzaSyCfjM1J25jy6-NmHTT-agO0kggY7vP_Nqc",
  authDomain: "reactboleta.firebaseapp.com",
  databaseURL: "https://reactboleta-default-rtdb.firebaseio.com",
  projectId: "reactboleta",
  storageBucket: "reactboleta.appspot.com",
  messagingSenderId: "780584427194",
  appId: "1:780584427194:web:a3956f07630fac6ce0ec83"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugSkipButtonIssue() {
  console.log('🔍 Debugging Skip Button Issue...\n');
  
  try {
    // Get all pickup groups
    const groupsSnap = await getDocs(collection(db, 'pickup_groups'));
    
    console.log('📋 All Pickup Groups Status Analysis:');
    console.log('=====================================');
    
    const statusCounts: { [status: string]: number } = {};
    const problematicGroups = [];
    
    groupsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const status = data.status || 'No status';
      
      // Count statuses
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Check for problematic cases
      if (typeof data.status === 'string') {
        const lowerStatus = data.status.toLowerCase();
        if (['segregacion', 'segregation'].includes(lowerStatus)) {
          // This group should appear in segregation page
          console.log(`🔸 SEGREGATION: ${data.clientName || 'Unknown'} (${doc.id})`);
          console.log(`   Status: "${data.status}"`);
          console.log(`   Client ID: ${data.clientId}`);
          console.log(`   Order: ${data.order ?? 'No order'}`);
          console.log('');
        } else if (lowerStatus === 'tunnel') {
          // This group should appear in tunnel page
          console.log(`🔹 TUNNEL: ${data.clientName || 'Unknown'} (${doc.id})`);
          console.log(`   Status: "${data.status}"`);
          console.log(`   Client ID: ${data.clientId}`);
          console.log(`   Order: ${data.order ?? 'No order'}`);
          console.log('');
        } else if (lowerStatus === 'conventional') {
          // This group should appear in conventional page
          console.log(`🔸 CONVENTIONAL: ${data.clientName || 'Unknown'} (${doc.id})`);
          console.log(`   Status: "${data.status}"`);
          console.log(`   Client ID: ${data.clientId}`);
          console.log(`   Order: ${data.order ?? 'No order'}`);
          console.log('');
        }
      }
    });
    
    console.log('\n📊 Status Summary:');
    console.log('==================');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count} groups`);
    });
    
    // Check for clients that might have multiple groups
    console.log('\n🔍 Checking for Duplicate Client Groups:');
    console.log('========================================');
    
    const clientGroups: { [clientId: string]: any[] } = {};
    
    groupsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.clientId) {
        if (!clientGroups[data.clientId]) {
          clientGroups[data.clientId] = [];
        }
        clientGroups[data.clientId].push({
          id: doc.id,
          clientName: data.clientName,
          status: data.status,
          order: data.order
        });
      }
    });
    
    // Look for clients with multiple active groups
    Object.entries(clientGroups).forEach(([clientId, groups]) => {
      if (groups.length > 1) {
        const activeGroups = groups.filter(g => 
          g.status && 
          !['deleted', 'Boleta Impresa', 'Entregado'].includes(g.status)
        );
        
        if (activeGroups.length > 1) {
          console.log(`⚠️  Client ${groups[0].clientName || clientId} has ${activeGroups.length} active groups:`);
          activeGroups.forEach((group, idx) => {
            console.log(`   ${idx + 1}. Status: "${group.status}", ID: ${group.id}`);
          });
          console.log('');
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error debugging skip button issue:', error);
  }
}

// Run the debug function
debugSkipButtonIssue().then(() => {
  console.log('✅ Debug analysis complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
