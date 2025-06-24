import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

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

async function seedPickupGroups() {
  const now = new Date();
  const demoGroups = [
    {
      clientId: "demo-client-1",
      clientName: "Demo Client 1",
      driverId: "demo-driver-1",
      driverName: "Demo Driver 1",
      startTime: Timestamp.fromDate(now),
      endTime: Timestamp.fromDate(new Date(now.getTime() + 60 * 60 * 1000)),
      totalWeight: 120,
      status: "Conventional",
      carts: [
        {
          id: "cart-1",
          name: "Cart 1",
          items: [
            { productId: "prod-1", productName: "Sheets", quantity: 10 },
            { productId: "prod-2", productName: "Towels", quantity: 5 }
          ],
          total: 15,
          createdAt: Timestamp.fromDate(now)
        }
      ],
      entries: [],
      numCarts: 1,
      segregatedCarts: null
    },
    {
      clientId: "demo-client-2",
      clientName: "Demo Client 2",
      driverId: "demo-driver-2",
      driverName: "Demo Driver 2",
      startTime: Timestamp.fromDate(now),
      endTime: Timestamp.fromDate(new Date(now.getTime() + 2 * 60 * 60 * 1000)),
      totalWeight: 200,
      status: "Tunnel",
      carts: [],
      entries: [],
      numCarts: 0,
      segregatedCarts: null
    }
  ];

  for (const group of demoGroups) {
    await addDoc(collection(db, "pickup_groups"), group);
    console.log(`Added group for client: ${group.clientName}`);
  }
  console.log("Seeding complete.");
}

seedPickupGroups().catch(console.error);
