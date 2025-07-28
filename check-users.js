import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCfjM1J25jy6-NmHTT-agO0kggY7vP_Nqc',
  authDomain: 'reactboleta.firebaseapp.com',
  databaseURL: 'https://reactboleta-default-rtdb.firebaseio.com',
  projectId: 'reactboleta',
  storageBucket: 'reactboleta.appspot.com',
  messagingSenderId: '780584427194',
  appId: '1:780584427194:web:a3956f07630fac6ce0ec83'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log('Users in database:');
    if (usersSnap.empty) {
      console.log('No users found in database');
      return;
    }
    
    usersSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${data.id || 'undefined'}, Username: ${data.username || 'undefined'}, Role: ${data.role || 'undefined'}`);
    });
    
    // Check specifically for user 1991
    const user1991 = usersSnap.docs.find(doc => doc.data().id === '1991');
    if (user1991) {
      console.log('\n✅ User 1991 (Eric) exists:', user1991.data());
    } else {
      console.log('\n❌ User 1991 (Eric) does NOT exist');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();
