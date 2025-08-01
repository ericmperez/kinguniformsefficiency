import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SignatureData {
  id: string;
  invoiceId: string;
  clientId: string;
  clientName: string;
  receiverName: string;
  signatureDataURL: string;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  deviceInfo?: {
    userAgent: string;
    platform: string;
  };
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  lastSyncAttempt?: string;
  notes?: string;
}

interface OfflineSignatureDB extends DBSchema {
  signatures: {
    key: string;
    value: SignatureData;
    indexes: {
      'by-sync-status': 'pending' | 'syncing' | 'synced' | 'failed';
      'by-timestamp': string;
      'by-invoice': string;
    };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      action: 'create' | 'update' | 'delete';
      data: any;
      timestamp: string;
      retryCount: number;
    };
  };
}

class OfflineSignatureService {
  private db: IDBPDatabase<OfflineSignatureDB> | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private syncListeners: Array<(status: string) => void> = [];
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private syncIntervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDB();
    this.setupOnlineListener();
    this.startPeriodicSync();
  }

  // Initialize IndexedDB
  private async initializeDB(): Promise<void> {
    try {
      this.db = await openDB<OfflineSignatureDB>('OfflineSignatures', 1, {
        upgrade(db) {
          // Signatures store
          const signaturesStore = db.createObjectStore('signatures', {
            keyPath: 'id'
          });
          signaturesStore.createIndex('by-sync-status', 'syncStatus');
          signaturesStore.createIndex('by-timestamp', 'timestamp');
          signaturesStore.createIndex('by-invoice', 'invoiceId');

          // Sync queue store
          db.createObjectStore('sync_queue', {
            keyPath: 'id'
          });
        },
      });
      console.log('📱 Offline signature database initialized');
      
      // Attempt sync if online
      if (this.isOnline) {
        this.syncPendingSignatures();
      }
    } catch (error) {
      console.error('❌ Failed to initialize offline signature database:', error);
    }
  }

  // Setup online/offline event listeners
  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored - syncing signatures');
      this.isOnline = true;
      this.notifyListeners('online');
      this.syncPendingSignatures();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Connection lost - signatures will be stored offline');
      this.isOnline = false;
      this.notifyListeners('offline');
    });
  }

  // Start periodic sync attempts
  private startPeriodicSync(): void {
    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingSignatures();
      }
    }, this.SYNC_INTERVAL);
  }

  // Stop periodic sync
  public stopPeriodicSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // Add sync status listener
  public addSyncListener(callback: (status: string) => void): void {
    this.syncListeners.push(callback);
  }

  // Remove sync status listener
  public removeSyncListener(callback: (status: string) => void): void {
    this.syncListeners = this.syncListeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of sync status changes
  private notifyListeners(status: string): void {
    this.syncListeners.forEach(listener => listener(status));
  }

  // Save signature offline
  public async saveSignatureOffline(signatureData: Omit<SignatureData, 'id' | 'syncStatus' | 'syncAttempts'>): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const id = `signature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get current location if available
    const location = await this.getCurrentLocation();
    
    const signature: SignatureData = {
      id,
      ...signatureData,
      location,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      },
      syncStatus: this.isOnline ? 'pending' : 'pending',
      syncAttempts: 0,
      timestamp: new Date().toISOString()
    };

    try {
      await this.db.add('signatures', signature);
      console.log(`📝 Signature saved offline: ${id}`);
      
      // If online, attempt immediate sync
      if (this.isOnline) {
        this.syncSpecificSignature(id);
      }
      
      this.notifyListeners('signature_saved');
      return id;
    } catch (error) {
      console.error('❌ Failed to save signature offline:', error);
      throw error;
    }
  }

  // Get current location (with permission)
  private getCurrentLocation(): Promise<SignatureData['location'] | undefined> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(undefined);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('📍 Location access denied or failed:', error.message);
          resolve(undefined);
        },
        {
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
          enableHighAccuracy: false
        }
      );
    });
  }

  // Get all offline signatures
  public async getAllOfflineSignatures(): Promise<SignatureData[]> {
    if (!this.db) return [];
    
    try {
      return await this.db.getAll('signatures');
    } catch (error) {
      console.error('❌ Failed to get offline signatures:', error);
      return [];
    }
  }

  // Get pending signatures count
  public async getPendingSignaturesCount(): Promise<number> {
    if (!this.db) return 0;
    
    try {
      const pendingSignatures = await this.db.getAllFromIndex('signatures', 'by-sync-status', 'pending');
      const failedSignatures = await this.db.getAllFromIndex('signatures', 'by-sync-status', 'failed');
      return pendingSignatures.length + failedSignatures.length;
    } catch (error) {
      console.error('❌ Failed to get pending signatures count:', error);
      return 0;
    }
  }

  // Sync specific signature
  private async syncSpecificSignature(signatureId: string): Promise<void> {
    if (!this.db || !this.isOnline) return;

    try {
      const signature = await this.db.get('signatures', signatureId);
      if (!signature || signature.syncStatus === 'synced') return;

      // Update status to syncing
      signature.syncStatus = 'syncing';
      signature.lastSyncAttempt = new Date().toISOString();
      await this.db.put('signatures', signature);

      // Attempt to sync with Firebase
      const success = await this.uploadSignatureToFirebase(signature);
      
      if (success) {
        signature.syncStatus = 'synced';
        console.log(`✅ Signature synced successfully: ${signatureId}`);
        this.notifyListeners('signature_synced');
      } else {
        signature.syncStatus = 'failed';
        signature.syncAttempts += 1;
        console.warn(`⚠️ Signature sync failed: ${signatureId} (attempt ${signature.syncAttempts})`);
      }

      await this.db.put('signatures', signature);
    } catch (error) {
      console.error(`❌ Error syncing signature ${signatureId}:`, error);
    }
  }

  // Upload signature to Firebase
  private async uploadSignatureToFirebase(signature: SignatureData): Promise<boolean> {
    try {
      // Import Firebase functions dynamically to avoid issues if Firebase isn't loaded
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      // Update the invoice with signature data
      const invoiceRef = doc(db, 'invoices', signature.invoiceId);
      
      await updateDoc(invoiceRef, {
        signature: {
          image: signature.signatureDataURL,
          name: signature.receiverName,
          timestamp: signature.timestamp,
          location: signature.location,
          deviceInfo: signature.deviceInfo,
          offlineSignature: true
        },
        receivedBy: signature.receiverName,
        deliveryCompletedAt: signature.timestamp,
        notes: signature.notes || ''
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to upload signature to Firebase:', error);
      return false;
    }
  }

  // Sync all pending signatures
  public async syncPendingSignatures(): Promise<void> {
    if (!this.db || !this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    this.notifyListeners('sync_started');

    try {
      const pendingSignatures = await this.db.getAllFromIndex('signatures', 'by-sync-status', 'pending');
      const failedSignatures = await this.db.getAllFromIndex('signatures', 'by-sync-status', 'failed');
      
      // Filter failed signatures that haven't exceeded max retry attempts
      const retryableFailedSignatures = failedSignatures.filter(
        sig => sig.syncAttempts < this.MAX_RETRY_ATTEMPTS
      );

      const signaturesToSync = [...pendingSignatures, ...retryableFailedSignatures];
      
      console.log(`🔄 Syncing ${signaturesToSync.length} signatures...`);

      for (const signature of signaturesToSync) {
        await this.syncSpecificSignature(signature.id);
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const remainingPending = await this.getPendingSignaturesCount();
      console.log(`✅ Sync completed. ${remainingPending} signatures still pending.`);
      
      this.notifyListeners(remainingPending === 0 ? 'sync_completed' : 'sync_partial');
    } catch (error) {
      console.error('❌ Error during signature sync:', error);
      this.notifyListeners('sync_failed');
    } finally {
      this.syncInProgress = false;
    }
  }

  // Force sync (manual trigger)
  public async forceSyncAll(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    
    this.syncInProgress = false; // Reset flag to allow force sync
    await this.syncPendingSignatures();
  }

  // Delete synced signatures older than specified days
  public async cleanupOldSignatures(daysToKeep: number = 30): Promise<number> {
    if (!this.db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    try {
      const allSignatures = await this.db.getAll('signatures');
      const toDelete = allSignatures.filter(
        sig => sig.syncStatus === 'synced' && sig.timestamp < cutoffISO
      );

      for (const signature of toDelete) {
        await this.db.delete('signatures', signature.id);
      }

      console.log(`🧹 Cleaned up ${toDelete.length} old synced signatures`);
      return toDelete.length;
    } catch (error) {
      console.error('❌ Error cleaning up old signatures:', error);
      return 0;
    }
  }

  // Get sync status summary
  public async getSyncStatus(): Promise<{
    isOnline: boolean;
    syncInProgress: boolean;
    pendingCount: number;
    syncedCount: number;
    failedCount: number;
    lastSyncAttempt?: string;
  }> {
    if (!this.db) {
      return {
        isOnline: this.isOnline,
        syncInProgress: this.syncInProgress,
        pendingCount: 0,
        syncedCount: 0,
        failedCount: 0
      };
    }

    try {
      const [pending, synced, failed] = await Promise.all([
        this.db.getAllFromIndex('signatures', 'by-sync-status', 'pending'),
        this.db.getAllFromIndex('signatures', 'by-sync-status', 'synced'),
        this.db.getAllFromIndex('signatures', 'by-sync-status', 'failed')
      ]);

      const lastSyncAttempt = [...pending, ...failed]
        .map(sig => sig.lastSyncAttempt)
        .filter(Boolean)
        .sort()
        .pop();

      return {
        isOnline: this.isOnline,
        syncInProgress: this.syncInProgress,
        pendingCount: pending.length,
        syncedCount: synced.length,
        failedCount: failed.length,
        lastSyncAttempt
      };
    } catch (error) {
      console.error('❌ Error getting sync status:', error);
      return {
        isOnline: this.isOnline,
        syncInProgress: this.syncInProgress,
        pendingCount: 0,
        syncedCount: 0,
        failedCount: 0
      };
    }
  }

  // Cleanup resources
  public async cleanup(): Promise<void> {
    this.stopPeriodicSync();
    this.syncListeners = [];
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Create singleton instance
export const offlineSignatureService = new OfflineSignatureService();

// Export types for use in components
export type { SignatureData };