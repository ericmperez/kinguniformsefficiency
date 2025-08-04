// Firebase Restore Script
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Your Firebase config
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

async function restoreFirestore(backupFilePath, options = {}) {
  const { clearExisting = false, collectionsToRestore = null } = options;
  
  console.log('🔄 Starting Firebase restore...');
  console.log(`📁 Backup file: ${backupFilePath}`);
  
  try {
    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    const collections = collectionsToRestore || Object.keys(backupData);
    
    console.log(`📦 Collections to restore: ${collections.join(', ')}`);
    
    for (const collectionName of collections) {
      console.log(`\n🔄 Restoring ${collectionName}...`);
      
      if (!backupData[collectionName]) {
        console.log(`⚠️  Collection ${collectionName} not found in backup`);
        continue;
      }
      
      const documents = backupData[collectionName];
      
      // Clear existing data if requested
      if (clearExisting) {
        console.log(`🗑️  Clearing existing ${collectionName} data...`);
        const snapshot = await getDocs(collection(db, collectionName));
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }
      
      // Restore documents
      console.log(`📝 Restoring ${documents.length} documents...`);
      
      for (const document of documents) {
        const { id, ...data } = document;
        await setDoc(doc(db, collectionName, id), data);
      }
      
      console.log(`✅ ${collectionName}: ${documents.length} documents restored`);
    }
    
    console.log('\n🎉 Restore completed successfully!');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw error;
  }
}

// Command line usage
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(`
Usage: node restore-firebase.js <backup-file> [options]

Options:
  --clear-existing    Clear existing data before restore
  --collections       Comma-separated list of collections to restore

Examples:
  node restore-firebase.js backups/firebase-backup-2025-08-02.json
  node restore-firebase.js backups/firebase-backup-2025-08-02.json --clear-existing
  node restore-firebase.js backups/firebase-backup-2025-08-02.json --collections=invoices,clients
  `);
  process.exit(1);
}

const backupFile = args[0];
const clearExisting = args.includes('--clear-existing');
const collectionsArg = args.find(arg => arg.startsWith('--collections='));
const collectionsToRestore = collectionsArg ? 
  collectionsArg.split('=')[1].split(',') : null;

restoreFirestore(backupFile, { clearExisting, collectionsToRestore })
  .then(() => {
    console.log('\n✅ Restore process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Restore process failed:', error);
    process.exit(1);
  });
