import { useState, useEffect, useCallback } from 'react';
import { offlineSignatureService, type SignatureData } from '../services/offlineSignatureService';

interface OfflineSignatureStatus {
  isOnline: boolean;
  syncInProgress: boolean;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncAttempt?: string;
}

export const useOfflineSignatures = () => {
  const [status, setStatus] = useState<OfflineSignatureStatus>({
    isOnline: navigator.onLine,
    syncInProgress: false,
    pendingCount: 0,
    syncedCount: 0,
    failedCount: 0
  });
  const [signatures, setSignatures] = useState<SignatureData[]>([]);
  const [loading, setLoading] = useState(true);

  // Update status from service
  const updateStatus = useCallback(async () => {
    try {
      const serviceStatus = await offlineSignatureService.getSyncStatus();
      setStatus(serviceStatus);
    } catch (error) {
      console.error('Failed to get offline signature status:', error);
    }
  }, []);

  // Get all signatures
  const loadSignatures = useCallback(async () => {
    try {
      setLoading(true);
      const allSignatures = await offlineSignatureService.getAllOfflineSignatures();
      setSignatures(allSignatures);
    } catch (error) {
      console.error('Failed to load offline signatures:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save signature offline
  const saveSignature = useCallback(async (signatureData: Omit<SignatureData, 'id' | 'syncStatus' | 'syncAttempts'>) => {
    try {
      const signatureId = await offlineSignatureService.saveSignatureOffline(signatureData);
      await loadSignatures(); // Refresh list
      await updateStatus();   // Update status
      return signatureId;
    } catch (error) {
      console.error('Failed to save signature:', error);
      throw error;
    }
  }, [loadSignatures, updateStatus]);

  // Force sync all pending signatures
  const forceSyncAll = useCallback(async () => {
    try {
      await offlineSignatureService.forceSyncAll();
      await updateStatus();
      await loadSignatures();
    } catch (error) {
      console.error('Failed to force sync:', error);
      throw error;
    }
  }, [updateStatus, loadSignatures]);

  // Cleanup old signatures
  const cleanupOldSignatures = useCallback(async (daysToKeep: number = 30) => {
    try {
      const deletedCount = await offlineSignatureService.cleanupOldSignatures(daysToKeep);
      await loadSignatures(); // Refresh list
      await updateStatus();   // Update status
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old signatures:', error);
      throw error;
    }
  }, [loadSignatures, updateStatus]);

  // Handle sync status changes
  useEffect(() => {
    const handleSyncStatus = (syncStatus: string) => {
      updateStatus();
      
      // Refresh signatures list on certain events
      if (['signature_saved', 'signature_synced', 'sync_completed'].includes(syncStatus)) {
        loadSignatures();
      }
    };

    // Add listener
    offlineSignatureService.addSyncListener(handleSyncStatus);

    // Initial load
    updateStatus();
    loadSignatures();

    // Cleanup listener on unmount
    return () => {
      offlineSignatureService.removeSyncListener(handleSyncStatus);
    };
  }, [updateStatus, loadSignatures]);

  // Get pending signatures (those not yet synced)
  const pendingSignatures = signatures.filter(
    sig => sig.syncStatus === 'pending' || sig.syncStatus === 'failed'
  );

  // Get synced signatures
  const syncedSignatures = signatures.filter(
    sig => sig.syncStatus === 'synced'
  );

  // Get failed signatures (exceeded retry attempts)
  const failedSignatures = signatures.filter(
    sig => sig.syncStatus === 'failed'
  );

  return {
    // Status
    status,
    loading,
    
    // Data
    signatures,
    pendingSignatures,
    syncedSignatures,
    failedSignatures,
    
    // Computed values
    hasPendingSignatures: pendingSignatures.length > 0,
    syncCompletionPercentage: signatures.length > 0 
      ? Math.round((syncedSignatures.length / signatures.length) * 100) 
      : 0,
    
    // Actions
    saveSignature,
    forceSyncAll,
    cleanupOldSignatures,
    
    // Refresh functions
    refresh: loadSignatures,
    refreshStatus: updateStatus
  };
}; 