import { useState } from "react";
import { LaundryCart } from "../types";

interface LaundryCartModalProps {
  show: boolean;
  onClose: () => void;
  onSelect: (cart: LaundryCart) => Promise<void>;
  carts: LaundryCart[];
  onAddCart: (cartName: string) => Promise<LaundryCart>;
}

export default function LaundryCartModal({
  show,
  onClose,
  onSelect,
  carts,
  onAddCart,
}: LaundryCartModalProps) {
  const [newCartName, setNewCartName] = useState("");
  const [showNewCartForm, setShowNewCartForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCartName.trim()) return;

    try {
      const newCart = await onAddCart(newCartName.trim());
      await onSelect(newCart);
      setNewCartName("");
      setShowNewCartForm(false);
    } catch (error) {
      console.error("Error adding cart:", error);
      alert("Error adding cart. Please try again.");
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex={-1}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Select or Create Cart</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            {!showNewCartForm ? (
              <>
                <div className="mb-3">
                  <h6>Select Existing Cart</h6>
                  <div className="list-group">
                    {carts.map((cart) => (
                      <button
                        key={cart.id}
                        className="list-group-item list-group-item-action"
                        onClick={() => onSelect(cart)}
                      >
                        {cart.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => setShowNewCartForm(true)}
                >
                  Create New Cart
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="cartName" className="form-label">
                    Cart Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="cartName"
                    value={newCartName}
                    onChange={(e) => setNewCartName(e.target.value)}
                    required
                  />
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowNewCartForm(false);
                      setNewCartName("");
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Cart
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 