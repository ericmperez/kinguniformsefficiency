// Real-time indicator hook for showing live data updates
import { useState, useCallback, useRef } from 'react';

export interface RealTimeStatus {
  isLive: boolean;
  lastUpdate: Date | null;
  updateCount: number;
  isUpdating: boolean;
  dataSource: string;
}

export interface RealTimeIndicatorHook {
  status: RealTimeStatus;
  markUpdate: (dataSource: string) => void;
  setUpdating: (updating: boolean) => void;
  reset: () => void;
}

/**
 * Hook for managing real-time update indicators
 * Shows when data is being refreshed and provides visual feedback
 */
export const useRealTimeIndicator = (initialDataSource = 'Unknown'): RealTimeIndicatorHook => {
  const [status, setStatus] = useState<RealTimeStatus>({
    isLive: false,
    lastUpdate: null,
    updateCount: 0,
    isUpdating: false,
    dataSource: initialDataSource,
  });

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const markUpdate = useCallback((dataSource: string) => {
    setStatus(prev => ({
      ...prev,
      isLive: true,
      lastUpdate: new Date(),
      updateCount: prev.updateCount + 1,
      isUpdating: false,
      dataSource,
    }));

    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Mark as not live after 30 seconds of no updates
    updateTimeoutRef.current = setTimeout(() => {
      setStatus(prev => ({
        ...prev,
        isLive: false,
      }));
    }, 30000);
  }, []);

  const setUpdating = useCallback((updating: boolean) => {
    setStatus(prev => ({
      ...prev,
      isUpdating: updating,
    }));
  }, []);

  const reset = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    setStatus({
      isLive: false,
      lastUpdate: null,
      updateCount: 0,
      isUpdating: false,
      dataSource: initialDataSource,
    });
  }, [initialDataSource]);

  return {
    status,
    markUpdate,
    setUpdating,
    reset,
  };
};
