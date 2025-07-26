// Cart editing utility component with direct Firebase integration
import React from 'react';
import { updateInvoice } from '../services/firebaseService';
import { Invoice, Cart } from '../types';
import { useAuth } from './AuthContext';

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

    // Check for duplicate cart names
    const existingCart = invoice.carts.find(c => 
      c.id !== cartId && c.name.trim().toLowerCase() === newName.trim().toLowerCase()
    );
    
    if (existingCart) {
      throw new Error('A cart with this name already exists');
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

    // Check for duplicate cart names
    const existingCart = invoice.carts.find(c => 
      c.name.trim().toLowerCase() === cartName.trim().toLowerCase()
    );
    
    if (existingCart) {
      throw new Error('A cart with this name already exists');
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
