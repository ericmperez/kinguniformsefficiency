import { getDocs, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../src/firebase.js';

async function debugTunnelOrdering() {
  console.log('🔍 Debugging Tunnel Ordering Issue...\n');
  
  try {
    // Get all Tunnel groups ordered by their creation time
    const tunnelQuery = query(
      collection(db, 'pickup_groups'),
      where('status', '==', 'Tunnel'),
      orderBy('startTime', 'asc')
    );
    
    const tunnelSnap = await getDocs(tunnelQuery);
    
    console.log('📋 Current Tunnel Groups (by creation time):');
    console.log('===================================================');
    
    tunnelSnap.docs.forEach((doc, index) => {
      const data = doc.data();
      const createdAt = data.startTime?.toDate?.() || new Date(data.startTime?.seconds * 1000) || 'Unknown';
      
      console.log(`${index + 1}. ${data.clientName || 'Unknown Client'}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Order: ${data.order ?? 'MISSING'}`);
      console.log(`   Created: ${createdAt}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Washing Type: ${data.washingType || 'Not set'}`);
      console.log('');
    });
    
    // Now get them ordered by their order field
    console.log('\n📋 Current Tunnel Groups (by order field):');
    console.log('==============================================');
    
    const tunnelGroups = tunnelSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by order field like the component does
    const sortedGroups = tunnelGroups.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    
    sortedGroups.forEach((group: any, index) => {
      console.log(`${index + 1}. ${group.clientName || 'Unknown Client'}`);
      console.log(`   Order: ${group.order ?? 'MISSING'}`);
      console.log(`   Expected Order: ${index}`);
      console.log(`   Order Correct: ${group.order === index ? '✅' : '❌'}`);
      console.log('');
    });
    
    // Check for ordering issues
    console.log('\n🔍 Analysis:');
    console.log('=============');
    
    const missingOrder = sortedGroups.filter((g: any) => typeof g.order !== 'number');
    const duplicateOrders = new Map();
    const gaps = [];
    
    sortedGroups.forEach((g: any) => {
      if (typeof g.order === 'number') {
        if (duplicateOrders.has(g.order)) {
          duplicateOrders.set(g.order, duplicateOrders.get(g.order) + 1);
        } else {
          duplicateOrders.set(g.order, 1);
        }
      }
    });
    
    // Check for gaps in order sequence
    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i];
      if (typeof group.order === 'number' && group.order !== i) {
        gaps.push(`Expected ${i}, got ${group.order} for ${group.clientName}`);
      }
    }
    
    console.log(`Groups missing order field: ${missingOrder.length}`);
    if (missingOrder.length > 0) {
      console.log('❌ Missing order:', missingOrder.map((g: any) => g.clientName).join(', '));
    }
    
    const duplicates = Array.from(duplicateOrders.entries()).filter(([_, count]) => count > 1);
    console.log(`Duplicate order values: ${duplicates.length}`);
    if (duplicates.length > 0) {
      console.log('❌ Duplicates:', duplicates.map(([order, count]) => `Order ${order} (${count} groups)`).join(', '));
    }
    
    console.log(`Order sequence gaps: ${gaps.length}`);
    if (gaps.length > 0) {
      console.log('❌ Gaps:', gaps.join(', '));
    }
    
    if (missingOrder.length === 0 && duplicates.length === 0 && gaps.length === 0) {
      console.log('✅ All ordering is correct!');
    } else {
      console.log('❌ Ordering issues detected. This could cause groups to appear out of order.');
    }
    
    // Suggested fix
    console.log('\n💡 Suggested Fix:');
    console.log('==================');
    console.log('1. Normalize all order values to be consecutive (0, 1, 2, ...)');
    console.log('2. Update the useEffect logic to prevent race conditions');
    console.log('3. Add better error handling for missing order fields');
    
  } catch (error) {
    console.error('❌ Error debugging tunnel ordering:', error);
  }
}

// Run the debug script
debugTunnelOrdering().catch(console.error);
