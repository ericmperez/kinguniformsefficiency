// Firebase Backup Script
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Your Firebase config (use the same one from your app)
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

// Collections to backup
const collections = [
  'invoices',
  'clients', 
  'products',
  'drivers',
  'users',
  'pickup_groups',
  'manual_conventional_products',
  'truck_assignments',
  'truck_completions',
  'truck_loading_verifications'
];

async function backupFirestore() {
  console.log('🔄 Starting Firebase backup...');
  
  const backupData = {};
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    for (const collectionName of collections) {
      console.log(`📦 Backing up ${collectionName}...`);
      
      const snapshot = await getDocs(collection(db, collectionName));
      const documents = [];
      
      snapshot.forEach((doc) => {
        documents.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      backupData[collectionName] = documents;
      console.log(`✅ ${collectionName}: ${documents.length} documents`);
    }
    
    // Create backup directory if it doesn't exist
    const backupDir = './backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    // Save backup file
    const filename = `firebase-backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    
    console.log(`✅ Backup completed: ${filepath}`);
    console.log(`📊 Total collections backed up: ${Object.keys(backupData).length}`);
    
    // Create a summary
    const summary = {
      timestamp: new Date().toISOString(),
      collections: Object.keys(backupData).map(name => ({
        name,
        count: backupData[name].length
      }))
    };
    
    console.log('\n📋 Backup Summary:');
    summary.collections.forEach(col => {
      console.log(`   ${col.name}: ${col.count} documents`);
    });
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

// Run backup
backupFirestore()
  .then(() => {
    console.log('\n🎉 Backup process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Backup process failed:', error);
    process.exit(1);
  });
