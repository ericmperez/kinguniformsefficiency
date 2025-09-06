// Notification Configuration Service
// Handles loading and saving of notification recipients

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface NotificationConfig {
  emailRecipients: string[];
  enabled: boolean;
  lastUpdated: string;
  updatedBy: string;
}

/**
 * Gets the current notification recipients from the database
 * Falls back to default recipients if none are configured
 */
export async function getNotificationRecipients(): Promise<string[]> {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'notificationConfig'));
    
    if (configDoc.exists()) {
      const config = configDoc.data() as NotificationConfig;
      if (config.enabled && config.emailRecipients.length > 0) {
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

/**
 * Gets the current notification configuration
 */
export async function getNotificationConfig(): Promise<NotificationConfig | null> {
  try {
    const configDoc = await getDoc(doc(db, 'settings', 'notificationConfig'));
    
    if (configDoc.exists()) {
      return configDoc.data() as NotificationConfig;
    }
    
    return null;
    
  } catch (error) {
    console.error('Error loading notification config:', error);
    return null;
  }
}
