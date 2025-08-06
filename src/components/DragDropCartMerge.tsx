// Drag and Drop Cart Merging
import React from 'react';
import { Cart, CartItem } from '../types';

interface DragDropCartProps {
  cart: Cart;
  onMerge: (sourceCartId: string, targetCartId: string) => void;
  onCartUpdate: (cartId: string, updatedCart: Cart) => void;
  children: React.ReactNode;
}

export const DragDropCart: React.FC<DragDropCartProps> = ({
  cart,
  onMerge,
  onCartUpdate,
  children
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isDraggedOver, setIsDraggedOver] = React.useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', cart.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isDragging) return; // Don't allow dropping on self
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggedOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggedOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggedOver(false);
    
    const sourceCartId = e.dataTransfer.getData('text/plain');
    if (sourceCartId && sourceCartId !== cart.id) {
      const shouldMerge = window.confirm(
        `Merge cart items into "${cart.name}"?\n\nThe source cart will be removed.`
      );
      
      if (shouldMerge) {
        onMerge(sourceCartId, cart.id);
      }
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`cart-container ${isDragging ? 'dragging' : ''} ${isDraggedOver ? 'drag-over' : ''}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        border: isDraggedOver ? '2px dashed #007bff' : '1px solid #dee2e6',
        borderRadius: '0.375rem',
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: isDraggedOver ? '#f8f9ff' : '#fff',
        transition: 'all 0.2s ease'
      }}
    >
      {children}
      
      {isDraggedOver && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-primary bg-opacity-10 rounded">
          <div className="text-primary fw-bold">
            <i className="bi bi-arrow-down-circle-fill me-2"></i>
            Drop to merge carts
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for drag and drop functionality
export const useDragDropCartMerge = (
  carts: Cart[],
  onCartsUpdate: (updatedCarts: Cart[]) => void
) => {
  const mergeCarts = (sourceCartId: string, targetCartId: string) => {
    const sourceCart = carts.find(c => c.id === sourceCartId);
    const targetCart = carts.find(c => c.id === targetCartId);
    
    if (!sourceCart || !targetCart) return;

    // Merge items
    const mergedItems: CartItem[] = [
      ...targetCart.items,
      ...sourceCart.items.map(item => ({
        ...item,
        addedAt: new Date().toISOString(),
        editedBy: 'Merged',
        editedAt: new Date().toISOString()
      }))
    ];

    // Update carts array
    const updatedCarts = carts
      .map(cart => cart.id === targetCartId 
        ? {
            ...cart,
            items: mergedItems,
            total: mergedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            needsReprint: true,
            lastModifiedAt: new Date().toISOString(),
            lastModifiedBy: 'Cart Merge'
          }
        : cart
      )
      .filter(cart => cart.id !== sourceCartId);

    onCartsUpdate(updatedCarts);
  };

  return { mergeCarts };
};
