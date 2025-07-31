// Server-side Firebase configuration for API routes
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCfjM1J25jy6-NmHTT-agO0kggY7vP_Nqc",
  authDomain: "reactboleta.firebaseapp.com",
  databaseURL: "https://reactboleta-default-rtdb.firebaseio.com",
  projectId: "reactboleta",
  storageBucket: "reactboleta.appspot.com",
  messagingSenderId: "780584427194",
  appId: "1:780584427194:web:a3956f07630fac6ce0ec83"
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
