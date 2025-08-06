// Cart Merge Utility - Direct Approach
import React from 'react';
import { updateInvoice } from '../services/firebaseService';
import { Invoice, Cart, CartItem } from '../types';
import { useAuth } from './AuthContext';

interface CartMergeOptions {
  sourceCartId: string;
  targetCartId: string;
  mergeStrategy: 'combine' | 'replace' | 'append';
}

export const useCartMerger = (invoice: Invoice, onCartUpdate: (updatedInvoice: Invoice) => void) => {
  const { user } = useAuth();

  // Direct cart merge without dialog prompts
  const mergeCartsDirect = async (sourceCartId: string, targetCartId: string): Promise<boolean> => {
    try {
      const sourceCart = invoice.carts.find(c => c.id === sourceCartId);
      const targetCart = invoice.carts.find(c => c.id === targetCartId);
      
      if (!sourceCart || !targetCart) {
        throw new Error('Source or target cart not found');
      }

      // Simple merge: add all source items to target cart
      const mergedItems = [
        ...targetCart.items,
        ...sourceCart.items.map(item => ({
          ...item,
          addedAt: new Date().toISOString(),
          editedBy: user?.username || 'System',
          editedAt: new Date().toISOString()
        }))
      ];

      const updatedCarts = invoice.carts
        .map(cart => cart.id === targetCartId 
          ? { 
              ...cart, 
              items: mergedItems,
              total: mergedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
              needsReprint: true,
              lastModifiedAt: new Date().toISOString(),
              lastModifiedBy: user?.username || 'Unknown User'
            }
          : cart
        )
        .filter(cart => cart.id !== sourceCartId); // Remove source cart

      await updateInvoice(invoice.id, { carts: updatedCarts });
      
      const updatedInvoice = { ...invoice, carts: updatedCarts };
      onCartUpdate(updatedInvoice);
      
      return true;
    } catch (error) {
      console.error('Failed to merge carts:', error);
      return false;
    }
  };

  // Find duplicate carts by name
  const findDuplicateCarts = (cartName: string): Cart[] => {
    return invoice.carts.filter(cart => 
      cart.name.trim().toLowerCase() === cartName.trim().toLowerCase()
    );
  };

  // Auto-resolve naming conflicts
  const resolveNamingConflict = async (cartName: string): Promise<string> => {
    const duplicates = findDuplicateCarts(cartName);
    
    if (duplicates.length === 0) {
      return cartName.trim();
    }

    // Generate numbered suffix
    let suffix = 2;
    let newName = `${cartName.trim()} (${suffix})`;
    
    while (findDuplicateCarts(newName).length > 0) {
      suffix++;
      newName = `${cartName.trim()} (${suffix})`;
    }
    
    return newName;
  };

  return {
    mergeCartsDirect,
    findDuplicateCarts,
    resolveNamingConflict
  };
};

// React component for cart merge selection
interface CartMergeModalProps {
  show: boolean;
  onClose: () => void;
  sourceCarts: Cart[];
  onMerge: (sourceId: string, targetId: string) => void;
}

export const CartMergeModal: React.FC<CartMergeModalProps> = ({
  show,
  onClose,
  sourceCarts,
  onMerge
}) => {
  const [selectedSource, setSelectedSource] = React.useState<string>('');
  const [selectedTarget, setSelectedTarget] = React.useState<string>('');

  if (!show) return null;

  const handleMerge = () => {
    if (selectedSource && selectedTarget) {
      onMerge(selectedSource, selectedTarget);
      onClose();
    }
  };

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Merge Carts</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">Source Cart (will be removed)</label>
              <select 
                className="form-select" 
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                <option value="">Select source cart...</option>
                {sourceCarts.map(cart => (
                  <option key={cart.id} value={cart.id}>
                    {cart.name} ({cart.items.length} items)
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Target Cart (will receive items)</label>
              <select 
                className="form-select"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
              >
                <option value="">Select target cart...</option>
                {sourceCarts.filter(cart => cart.id !== selectedSource).map(cart => (
                  <option key={cart.id} value={cart.id}>
                    {cart.name} ({cart.items.length} items)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              disabled={!selectedSource || !selectedTarget}
              onClick={handleMerge}
            >
              Merge Carts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
