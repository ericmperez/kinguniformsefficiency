import { getDocs, collection, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase';

async function fixSegregatedCarts() {
  const groupsSnap = await getDocs(collection(db, 'pickup_groups'));
  let updated = 0;
  for (const groupDoc of groupsSnap.docs) {
    const group = groupDoc.data();
    if (!group.clientId) continue;
    // Fetch client
    const clientSnap = await getDoc(doc(db, 'clients', group.clientId));
    if (!clientSnap.exists()) continue;
    const client = clientSnap.data();
    // Only update if Tunnel, doesn't need segregation, and segregatedCarts !== numCarts
    if (
      client.washingType === 'Tunnel' &&
      client.segregation === false &&
      typeof group.numCarts === 'number' &&
      group.segregatedCarts !== group.numCarts
    ) {
      await updateDoc(doc(db, 'pickup_groups', groupDoc.id), {
        segregatedCarts: group.numCarts,
      });
      updated++;
      console.log(`Updated group ${groupDoc.id}: segregatedCarts -> ${group.numCarts}`);
    }
  }
  console.log(`Done. Updated ${updated} pickup_groups.`);
}

fixSegregatedCarts().catch(console.error);
