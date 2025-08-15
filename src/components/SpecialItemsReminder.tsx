import React, { useState, useEffect } from 'react';
import { ManualConventionalProduct } from '../types';

interface SpecialItemsReminderProps {
  showTitle?: boolean;
  maxItems?: number;
  onItemAction?: (itemId: string, action: 'confirm' | 'skip') => void;
}

const SpecialItemsReminder: React.FC<SpecialItemsReminderProps> = ({
  showTitle = true,
  maxItems = 5,
  onItemAction
}) => {
  const [pendingItems, setPendingItems] = useState<ManualConventionalProduct[]>([]);
  const [skippedItems, setSkippedItems] = useState<ManualConventionalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSpecialItems = async () => {
      try {
        const { getPendingSpecialItems, getSkippedSpecialItems } = await import('../services/firebaseService');
        const [pending, skipped] = await Promise.all([
          getPendingSpecialItems() as Promise<ManualConventionalProduct[]>,
          getSkippedSpecialItems() as Promise<ManualConventionalProduct[]>
        ]);

        setPendingItems(pending.slice(0, maxItems));
        setSkippedItems(skipped.slice(0, maxItems));
      } catch (error) {
        console.error('Error fetching special items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpecialItems();

    // Refresh every 2 minutes
    const interval = setInterval(fetchSpecialItems, 120000);

    return () => clearInterval(interval);
  }, [maxItems]);

  const handleConfirmItem = async (item: ManualConventionalProduct) => {
    try {
      const { confirmSpecialItem } = await import('../services/firebaseService');
      const { logActivity } = await import('../services/firebaseService');
      
      await confirmSpecialItem(item.id, 'System');
      
      // Remove from local state
      setPendingItems(prev => prev.filter(p => p.id !== item.id));
      setSkippedItems(prev => prev.filter(p => p.id !== item.id));
      
      await logActivity({
        type: 'Special Item',
        message: `Special item "${item.productName}" for ${item.clientName} confirmed for invoice inclusion from reminder dashboard`,
        user: 'System',
      });

      if (onItemAction) {
        onItemAction(item.id, 'confirm');
      }
    } catch (error) {
      console.error('Error confirming special item:', error);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const totalItems = pendingItems.length + skippedItems.length;

  if (totalItems === 0) {
    // Show a minimal widget when no special items exist for debugging/demonstration
    return (
      <div className="card border-success">
        <div className="card-header bg-success text-white">
          <h6 className="mb-0">
            ✅ Special Items Status
          </h6>
        </div>
        <div className="card-body text-center">
          <p className="mb-2">No special items requiring attention</p>
          <small className="text-muted">
            Special items (blankets, colchas, uniforms) will appear here when they need confirmation
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-warning">
      {showTitle && (
        <div className="card-header bg-warning text-dark">
          <h6 className="mb-0">
            🔔 Special Items Reminder
            <span className="badge bg-danger ms-2">{totalItems}</span>
          </h6>
        </div>
      )}
      <div className="card-body">
        {/* Pending Confirmations */}
        {pendingItems.length > 0 && (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <small className="text-warning fw-bold">
                ⚠️ Awaiting Confirmation ({pendingItems.length})
              </small>
            </div>
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="d-flex justify-content-between align-items-center border-bottom py-2"
              >
                <div className="flex-grow-1">
                  <div className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>
                    {item.clientName}
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    <span className="badge bg-info me-1">{item.category}</span>
                    {item.productName} x{item.quantity}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {item.createdAt && new Date((item.createdAt as any).seconds * 1000).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleConfirmItem(item)}
                  title="Confirm for invoice"
                >
                  ✅
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Skipped Items */}
        {skippedItems.length > 0 && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <small className="text-info fw-bold">
                📋 Skipped Items ({skippedItems.length})
              </small>
            </div>
            {skippedItems.map((item) => (
              <div
                key={item.id}
                className="d-flex justify-content-between align-items-center border-bottom py-2 bg-light"
              >
                <div className="flex-grow-1">
                  <div className="fw-bold text-secondary" style={{ fontSize: '0.9rem' }}>
                    {item.clientName}
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    <span className="badge bg-secondary me-1">{item.category}</span>
                    {item.productName} x{item.quantity}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Skipped: {item.skipReason || 'No reason provided'}
                  </div>
                </div>
                <button
                  className="btn btn-outline-success btn-sm"
                  onClick={() => handleConfirmItem(item)}
                  title="Ready to include"
                >
                  ✅
                </button>
              </div>
            ))}
          </div>
        )}

        {maxItems < totalItems && (
          <div className="text-center mt-3">
            <small className="text-muted">
              Showing {Math.min(pendingItems.length + skippedItems.length, maxItems)} of {totalItems} items
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpecialItemsReminder;
