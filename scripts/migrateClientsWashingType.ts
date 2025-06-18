import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function migrateClientsWashingType() {
  const clientsRef = collection(db, 'clients');
  const snapshot = await getDocs(clientsRef);
  let updated = 0;
  for (const clientDoc of snapshot.docs) {
    const data = clientDoc.data();
    let washingType = data.washingType;
    // Infer washingType from Conventional or Status value
    if (!washingType) {
      if (data.Conventional === true || data.status === 'Conventional') {
        washingType = 'Conventional';
      } else {
        washingType = 'Tunnel';
      }
      await updateDoc(doc(db, 'clients', clientDoc.id), { washingType });
      updated++;
      console.log(`Updated client ${clientDoc.id} with washingType: ${washingType}`);
    }
  }
  console.log(`Migration complete. Updated ${updated} clients.`);
}

migrateClientsWashingType().catch(console.error);
