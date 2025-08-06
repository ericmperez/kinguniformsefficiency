// Cart Context Menu for Merging
import React from 'react';
import { Cart } from '../types';

interface CartContextMenuProps {
  cart: Cart;
  position: { x: number; y: number };
  onClose: () => void;
  onMergeWith: (cartId: string) => void;
  onRename: (cartId: string) => void;
  onDelete: (cartId: string) => void;
  availableCarts: Cart[];
}

export const CartContextMenu: React.FC<CartContextMenuProps> = ({
  cart,
  position,
  onClose,
  onMergeWith,
  onRename,
  onDelete,
  availableCarts
}) => {
  const [showMergeSubmenu, setShowMergeSubmenu] = React.useState(false);

  React.useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const mergeableCarts = availableCarts.filter(c => c.id !== cart.id);

  return (
    <div 
      className="position-fixed bg-white border rounded shadow-sm"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 1050,
        minWidth: '200px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="list-group list-group-flush">
        <button 
          className="list-group-item list-group-item-action d-flex align-items-center"
          onClick={() => onRename(cart.id)}
        >
          <i className="bi bi-pencil me-2"></i>
          Rename Cart
        </button>
        
        {mergeableCarts.length > 0 && (
          <div className="position-relative">
            <button 
              className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
              onMouseEnter={() => setShowMergeSubmenu(true)}
              onMouseLeave={() => setShowMergeSubmenu(false)}
            >
              <span>
                <i className="bi bi-shuffle me-2"></i>
                Merge with...
              </span>
              <i className="bi bi-chevron-right"></i>
            </button>
            
            {showMergeSubmenu && (
              <div 
                className="position-absolute bg-white border rounded shadow-sm"
                style={{
                  left: '100%',
                  top: 0,
                  minWidth: '200px',
                  zIndex: 1051
                }}
                onMouseEnter={() => setShowMergeSubmenu(true)}
                onMouseLeave={() => setShowMergeSubmenu(false)}
              >
                <div className="list-group list-group-flush">
                  {mergeableCarts.map(targetCart => (
                    <button
                      key={targetCart.id}
                      className="list-group-item list-group-item-action small"
                      onClick={() => {
                        onMergeWith(targetCart.id);
                        onClose();
                      }}
                    >
                      <div className="fw-bold">{targetCart.name}</div>
                      <small className="text-muted">
                        {targetCart.items.length} items
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <button 
          className="list-group-item list-group-item-action d-flex align-items-center text-danger"
          onClick={() => onDelete(cart.id)}
        >
          <i className="bi bi-trash me-2"></i>
          Delete Cart
        </button>
      </div>
    </div>
  );
};
