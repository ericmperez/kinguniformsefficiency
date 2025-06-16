import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCfjM1J25jy6-NmHTT-agO0kggY7vP_Nqc",
  authDomain: "reactboleta.firebaseapp.com",
  databaseURL: "https://reactboleta-default-rtdb.firebaseio.com",
  projectId: "reactboleta",
  storageBucket: "reactboleta.appspot.com",
  messagingSenderId: "780584427194",
  appId: "1:780584427194:web:a3956f07630fac6ce0ec83"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migratePickupEntryTimestamps() {
  const entriesRef = collection(db, 'pickup_entries');
  const snapshot = await getDocs(entriesRef);
  let updated = 0;
  for (const entryDoc of snapshot.docs) {
    const data = entryDoc.data();
    if (typeof data.timestamp === 'string') {
      const date = new Date(data.timestamp);
      if (!isNaN(date.getTime())) {
        await updateDoc(doc(db, 'pickup_entries', entryDoc.id), {
          timestamp: Timestamp.fromDate(date),
        });
        updated++;
        console.log(`Migrated entry ${entryDoc.id}`);
      }
    }
  }
  console.log(`Migration complete. Updated ${updated} entries.`);
}

migratePickupEntryTimestamps().catch(console.error);
