// Cart editing utility component with direct Firebase integration
import React from 'react';
import { updateInvoice } from '../services/firebaseService';
import { Invoice, Cart, CartItem } from '../types';
import { useAuth } from './AuthContext';

// Helper function to merge cart items as individual entries
function mergeCartItems(existingItems: CartItem[], newItems: CartItem[]): CartItem[] {
  // Simply combine all items as individual entries without grouping
  const mergedItems = [...existingItems];
  
  newItems.forEach(newItem => {
    // Add each item as a separate entry, regardless of product or price duplicates
    mergedItems.push({
      ...newItem,
      addedAt: new Date().toISOString(), // Update timestamp for merged item
      editedBy: newItem.addedBy || "System",
      editedAt: new Date().toISOString()
    });
  });
  
  return mergedItems;
}

interface CartEditHandlerProps {
  invoice: Invoice;
  onCartUpdate: (updatedInvoice: Invoice) => void;
  onError?: (error: string) => void;
}

export const useCartEditor = (invoice: Invoice, onCartUpdate: (updatedInvoice: Invoice) => void) => {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const { user } = useAuth();

  const updateCartName = async (cartId: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) {
      throw new Error('Cart name cannot be empty');
    }

    // Check for duplicate cart names (excluding the current cart being edited)
    const existingCart = invoice.carts.find(c => 
      c.id !== cartId && c.name.trim().toLowerCase() === newName.trim().toLowerCase()
    );
    
    if (existingCart) {
      // Instead of throwing an error, show merge dialog like the main handlers
      const userWantsToMerge = window.confirm(
        `A cart named "${newName.trim()}" already exists.\n\n` +
        `Click OK to merge the items with the existing cart, or Cancel to create a separate cart with a numbered suffix.`
      );
      
      if (userWantsToMerge) {
        // Merge the current cart items into the existing cart
        const currentCart = invoice.carts.find(c => c.id === cartId);
        if (currentCart && currentCart.items && currentCart.items.length > 0) {
          // Merge items from current cart into existing cart using the same logic as ActiveInvoices
          const mergedItems = mergeCartItems(existingCart.items || [], currentCart.items);
          const updatedCarts = invoice.carts
            .map(cart => cart.id === existingCart.id 
              ? { ...cart, items: mergedItems, total: mergedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) }
              : cart
            )
            .filter(cart => cart.id !== cartId); // Remove the current cart
          
          await updateInvoice(invoice.id, { carts: updatedCarts });
          
          const updatedInvoice = { ...invoice, carts: updatedCarts };
          onCartUpdate(updatedInvoice);
          
          console.log('✅ Cart merged successfully');
          return true;
        } else {
          // If current cart has no items, just delete it and return existing cart ID
          const updatedCarts = invoice.carts.filter(cart => cart.id !== cartId);
          await updateInvoice(invoice.id, { carts: updatedCarts });
          
          const updatedInvoice = { ...invoice, carts: updatedCarts };
          onCartUpdate(updatedInvoice);
          
          console.log('✅ Empty cart removed, existing cart kept');
          return true;
        }
      } else {
        // Create a cart with numbered suffix
        let suffix = 2;
        let newCartName = `${newName.trim()} (${suffix})`;
        while (invoice.carts.some(c => c.name.trim().toLowerCase() === newCartName.trim().toLowerCase())) {
          suffix++;
          newCartName = `${newName.trim()} (${suffix})`;
        }
        newName = newCartName;
      }
    }

    setIsUpdating(true);
    
    try {
      console.log('%c🏷️ Updating cart name directly:', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;', { 
        invoiceId: invoice.id, 
        cartId, 
        oldName: invoice.carts.find(c => c.id === cartId)?.name,
        newName: newName.trim()
      });

      // Create updated carts array
      const updatedCarts = invoice.carts.map(cart => 
        cart.id === cartId 
          ? { ...cart, name: newName.trim() } 
          : cart
      );

      // Update in Firebase directly
      await updateInvoice(invoice.id, { 
        carts: updatedCarts
      });

      // Update local state
      const updatedInvoice = {
        ...invoice,
        carts: updatedCarts
      };
      
      onCartUpdate(updatedInvoice);
      
      console.log('%c✅ Cart name updated successfully', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;');
      return true;
      
    } catch (error: any) {
      console.error('%c❌ Failed to update cart name:', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;', error);
      throw new Error(`Failed to update cart name: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteCart = async (cartId: string): Promise<boolean> => {
    setIsUpdating(true);
    
    try {
      console.log('%c🗑️ Deleting cart directly:', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;', { 
        invoiceId: invoice.id, 
        cartId,
        cartName: invoice.carts.find(c => c.id === cartId)?.name
      });

      // Create updated carts array without the deleted cart
      const updatedCarts = invoice.carts.filter(cart => cart.id !== cartId);

      // Update in Firebase directly
      await updateInvoice(invoice.id, { 
        carts: updatedCarts
      });

      // Update local state
      const updatedInvoice = {
        ...invoice,
        carts: updatedCarts
      };
      
      onCartUpdate(updatedInvoice);
      
      console.log('%c✅ Cart deleted successfully', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;');
      return true;
      
    } catch (error: any) {
      console.error('%c❌ Failed to delete cart:', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;', error);
      throw new Error(`Failed to delete cart: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const addCart = async (cartName: string): Promise<Cart> => {
    if (!cartName.trim()) {
      throw new Error('Cart name cannot be empty');
    }

    // Check for duplicate cart names and handle merging
    const existingCart = invoice.carts.find(c => 
      c.name.trim().toLowerCase() === cartName.trim().toLowerCase()
    );
    
    if (existingCart) {
      // Show merge dialog like the main handlers
      const userWantsToMerge = window.confirm(
        `A cart named "${cartName.trim()}" already exists.\n\n` +
        `Click OK to merge the items with the existing cart, or Cancel to create a separate cart with a numbered suffix.`
      );
      
      if (userWantsToMerge) {
        // Return the existing cart for merging
        return existingCart;
      } else {
        // Create a cart with numbered suffix
        let suffix = 2;
        let newCartName = `${cartName.trim()} (${suffix})`;
        while (invoice.carts.some(c => c.name.trim().toLowerCase() === newCartName.trim().toLowerCase())) {
          suffix++;
          newCartName = `${cartName.trim()} (${suffix})`;
        }
        cartName = newCartName;
      }
    }

    setIsUpdating(true);
    
    try {
      console.log('%c➕ Adding new cart directly:', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;', { 
        invoiceId: invoice.id, 
        cartName: cartName.trim()
      });

      // Create new cart
      const newCart: Cart = {
        id: Date.now().toString(),
        name: cartName.trim(),
        items: [],
        total: 0,
        createdAt: new Date().toISOString(),
        createdBy: user?.username || 'Unknown',
      };

      // Create updated carts array
      const updatedCarts = [...invoice.carts, newCart];

      // Update in Firebase directly
      await updateInvoice(invoice.id, { 
        carts: updatedCarts
      });

      // Update local state
      const updatedInvoice = {
        ...invoice,
        carts: updatedCarts
      };
      
      onCartUpdate(updatedInvoice);
      
      console.log('%c✅ Cart added successfully', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;');
      return newCart;
      
    } catch (error: any) {
      console.error('%c❌ Failed to add cart:', 'color: #fff; background: #111; font-weight: bold; padding: 2px 6px;', error);
      throw new Error(`Failed to add cart: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateCartName,
    deleteCart,
    addCart,
    isUpdating
  };
};

// Black-themed notification modal
export const NotificationModal: React.FC<{
  open: boolean;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}> = ({ open, message, onClose, onConfirm, confirmText = 'OK', cancelText = 'Cancel' }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#111',
        color: '#fff',
        borderRadius: 12,
        padding: '32px 28px',
        minWidth: 340,
        boxShadow: '0 8px 32px #000',
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 500,
      }}>
        <div style={{ marginBottom: 24 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          {onConfirm && (
            <button
              onClick={() => { onConfirm(); onClose(); }}
              style={{ background: '#fff', color: '#111', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
            >
              {confirmText}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
          >
            {onConfirm ? cancelText : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default useCartEditor;
