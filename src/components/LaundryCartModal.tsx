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
  const [showKeypad, setShowKeypad] = useState(false);
  const [cartNameError, setCartNameError] = useState("");

  // Keypad input handler for cart name
  const handleKeypadInput = (val: string) => {
    setNewCartName((prev) => {
      if (val === "C") return "";
      if (val === "←") return prev.slice(0, -1);
      if (val === "_") return prev + " "; // Space
      return prev + val;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCartNameError("");
    const trimmedName = newCartName.trim();
    if (!trimmedName) return;
    // Check for duplicate name (case-insensitive)
    const duplicate = carts.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setCartNameError("A cart with this name already exists. Please choose a unique name.");
      return;
    }
    try {
      const newCart = await onAddCart(trimmedName);
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
                  <div className="d-flex gap-2 align-items-center">
                    <input
                      type="text"
                      className="form-control"
                      id="cartName"
                      value={newCartName}
                      onChange={(e) => {
                        setNewCartName(e.target.value);
                        setCartNameError("");
                      }}
                      required
                      readOnly={showKeypad}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setShowKeypad((v) => !v)}
                    >
                      {showKeypad ? "Hide Keypad" : "Show Keypad"}
                    </button>
                  </div>
                  {cartNameError && (
                    <div className="text-danger mt-1" style={{ fontSize: 14 }}>{cartNameError}</div>
                  )}
                  {showKeypad && (
                    <div className="mt-3">
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        {[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].map((key) => (
                          <button
                            key={key}
                            type="button"
                            className="btn btn-outline-dark mb-1"
                            style={{ width: 40, height: 40, fontSize: 18 }}
                            onClick={() => handleKeypadInput(key)}
                          >
                            {key}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn btn-warning mb-1"
                          style={{ width: 40, height: 40, fontSize: 18 }}
                          onClick={() => handleKeypadInput("_")}
                        >
                          _
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger mb-1"
                          style={{ width: 40, height: 40, fontSize: 18 }}
                          onClick={() => handleKeypadInput("C")}
                        >
                          C
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary mb-1"
                          style={{ width: 40, height: 40, fontSize: 18 }}
                          onClick={() => handleKeypadInput("←")}
                        >
                          &larr;
                        </button>
                      </div>
                    </div>
                  )}
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