// Server-side Notification Configuration Service
// Handles loading notification recipients from Firebase for cron jobs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Firebase configuration (same as frontend)
const firebaseConfig = {
  apiKey: "AIzaSyDbPJI0_UWaJQMD4y_2EoEGDjzElD4FtO8",
  authDomain: "king-uniforms.firebaseapp.com",
  projectId: "king-uniforms",
  storageBucket: "king-uniforms.appspot.com",
  messagingSenderId: "565655825628",
  appId: "1:565655825628:web:e32b4e4e4b9c3e08a5d4b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Gets the current notification recipients from the database
 * Falls back to default recipients if none are configured
 */
export async function getNotificationRecipients() {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'notificationConfig'));
    
    if (configDoc.exists()) {
      const config = configDoc.data();
      if (config.enabled && config.emailRecipients && config.emailRecipients.length > 0) {
        return config.emailRecipients;
      }
    }
    
    // Fall back to default recipients if no configuration is found
    return [
      'rmperez@kinguniforms.net',
      'eric.perez.pr@gmail.com',
      'jperez@kinguniforms.net'
    ];
    
  } catch (error) {
    console.error('Error loading notification recipients:', error);
    
    // Fall back to default recipients on error
    return [
      'rmperez@kinguniforms.net',
      'eric.perez.pr@gmail.com',
      'jperez@kinguniforms.net'
    ];
  }
}
