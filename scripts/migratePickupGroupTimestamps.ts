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

async function migratePickupGroupTimestamps() {
  const groupsRef = collection(db, 'pickup_groups');
  const snapshot = await getDocs(groupsRef);
  let updated = 0;
  for (const groupDoc of snapshot.docs) {
    const data = groupDoc.data();
    let update: any = {};
    if (typeof data.startTime === 'string') {
      const date = new Date(data.startTime);
      if (!isNaN(date.getTime())) {
        update.startTime = Timestamp.fromDate(date);
      }
    }
    if (typeof data.endTime === 'string') {
      const date = new Date(data.endTime);
      if (!isNaN(date.getTime())) {
        update.endTime = Timestamp.fromDate(date);
      }
    }
    if (Object.keys(update).length > 0) {
      await updateDoc(doc(db, 'pickup_groups', groupDoc.id), update);
      updated++;
      console.log(`Migrated group ${groupDoc.id}`);
    }
  }
  console.log(`Migration complete. Updated ${updated} groups.`);
}

migratePickupGroupTimestamps().catch(console.error);
