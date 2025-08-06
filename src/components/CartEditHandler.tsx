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
          
          // Mark merged cart as needing reprint
          const now = new Date().toISOString();
          const currentUser = user?.username || 'Unknown User';
          
          const updatedCarts = invoice.carts
            .map(cart => cart.id === existingCart.id 
              ? { 
                  ...cart, 
                  items: mergedItems, 
                  total: mergedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
                  needsReprint: true,
                  lastModifiedAt: now,
                  lastModifiedBy: currentUser
                }
              : cart
            )
            .filter(cart => cart.id !== cartId); // Remove the current cart
          
          await updateInvoice(invoice.id, { carts: updatedCarts });
          
          const updatedInvoice = { ...invoice, carts: updatedCarts };
          onCartUpdate(updatedInvoice);
          
          console.log('✅ Cart merged successfully and marked for reprint');
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
      console.log('🏷️ Updating cart name directly:', { 
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
      
      console.log('✅ Cart name updated successfully');
      return true;
      
    } catch (error: any) {
      console.error('❌ Failed to update cart name:', error);
      throw new Error(`Failed to update cart name: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteCart = async (cartId: string): Promise<boolean> => {
    setIsUpdating(true);
    
    try {
      console.log('🗑️ Deleting cart directly:', { 
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
      
      console.log('✅ Cart deleted successfully');
      return true;
      
    } catch (error: any) {
      console.error('❌ Failed to delete cart:', error);
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
      console.log('➕ Adding new cart directly:', { 
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
      
      console.log('✅ Cart added successfully');
      return newCart;
      
    } catch (error: any) {
      console.error('❌ Failed to add cart:', error);
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

export default useCartEditor;
