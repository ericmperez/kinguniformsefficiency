import React from "react";
import { Invoice, Product, Client, Cart, LaundryCart } from "../types";

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
  client: Client | undefined;
  products: Product[];
  onAddCart: (cartName: string) => Promise<LaundryCart>;
  onAddProductToCart: (cartId: string, productId: string, quantity: number) => void;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  invoice,
  onClose,
  client,
  products,
  onAddCart,
  onAddProductToCart,
}) => {
  const [newCartName, setNewCartName] = React.useState("");
  const [addProductCartId, setAddProductCartId] = React.useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [productQty, setProductQty] = React.useState(1);
  const [showNewCartInput, setShowNewCartInput] = React.useState(false);
  const [showCartKeypad, setShowCartKeypad] = React.useState(false);
  const [showProductKeypad, setShowProductKeypad] = React.useState<null | { cartId: string; productId: string }>(null);
  const [keypadQty, setKeypadQty] = React.useState<string>("");

  // Local state for carts to enable instant UI update
  const [localCarts, setLocalCarts] = React.useState(invoice.carts);

  // Sync local carts with invoice changes
  React.useEffect(() => {
    setLocalCarts(invoice.carts);
  }, [invoice.carts]);

  // Get only products associated with this client
  const clientProducts = React.useMemo(() => {
    if (!client) return [];
    return products.filter((p) => client.selectedProducts.includes(p.id));
  }, [client, products]);

  // Helper: keypad buttons
  const keypadButtons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '0', '←', 'OK',
  ];

  return (
    <div
      className="modal show"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2000,
        overflowY: "auto",
      }}
    >
      <div
        className="modal-dialog modal-lg"
        style={{
          margin: 0,
          maxWidth: 800,
          width: "100%",
        }}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Invoice #{invoice.invoiceNumber}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <h6>Client: {invoice.clientName}</h6>
            <h6>Date: {invoice.date}</h6>
            <h6>Total Carts: {invoice.carts.length}</h6>
            {/* Show group weight if available on invoice or client */}
            {typeof invoice.totalWeight === 'number' && (
              <h6 className="text-success">Group Weight: {invoice.totalWeight} lbs</h6>
            )}
            {client && typeof (client as any).groupWeight === 'number' && !invoice.totalWeight && (
              <h6 className="text-success">Group Weight: {(client as any).groupWeight} lbs</h6>
            )}
            <div className="mb-3">
              {!showNewCartInput ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowNewCartInput(true);
                    setShowCartKeypad(true);
                    setNewCartName("");
                  }}
                >
                  Create New Cart
                </button>
              ) : (
                <div className="d-flex gap-2 align-items-center">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="New Cart Name"
                    value={newCartName}
                    readOnly
                    style={{ background: '#f8fafc', cursor: 'pointer' }}
                    onFocus={() => setShowCartKeypad(true)}
                  />
                  <button
                    className="btn btn-success"
                    onClick={async () => {
                      if (newCartName.trim()) {
                        const newCart: LaundryCart = await onAddCart(newCartName.trim());
                        setLocalCarts([...localCarts, {
                          id: newCart.id,
                          name: newCart.name,
                          items: [],
                          total: 0,
                          createdAt: new Date().toISOString(),
                        }]);
                        setNewCartName("");
                        setShowNewCartInput(false);
                        setShowCartKeypad(false);
                      }
                    }}
                    disabled={!newCartName.trim()}
                  >
                    Add
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowNewCartInput(false);
                      setShowCartKeypad(false);
                      setNewCartName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {/* Keypad for cart name input */}
              {showCartKeypad && (
                <div className="keypad-container mt-2" style={{ maxWidth: 220 }}>
                  <div className="d-flex flex-wrap">
                    {keypadButtons.map((btn, idx) => (
                      <button
                        key={btn + idx}
                        className="btn btn-light m-1"
                        style={{ width: 60, height: 48, fontSize: 22, fontWeight: 600 }}
                        onClick={() => {
                          if (btn === 'OK') {
                            setShowCartKeypad(false);
                          } else if (btn === '←') {
                            setNewCartName((prev) => prev.slice(0, -1));
                          } else {
                            setNewCartName((prev) => prev + btn);
                          }
                        }}
                        tabIndex={-1}
                        type="button"
                      >
                        {btn}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {localCarts.map((cart) => (
              <div key={cart.id} className="cart-section mb-4 p-2 border rounded">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <h3 style={{ fontWeight: 800, color: '#0E62A0', marginBottom: 8 }}>CARRO # {cart.name}</h3>
                    {/* Show weight if present as a custom property (ignore TS error if needed) */}
                    {('weight' in cart) && (cart as any).weight && (
                      <small className="text-success">Weight: {(cart as any).weight} lbs</small>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-danger btn-sm"
                      title="Delete Cart"
                      onClick={async () => {
                        if (window.confirm(`Delete cart '${cart.name}'?`)) {
                          setLocalCarts(localCarts.filter((c) => c.id !== cart.id));
                          await onAddCart("__delete__" + cart.id);
                        }
                      }}
                    >
                      <i className="bi bi-trash" />
                    </button>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      title="Edit Cart Name"
                      onClick={async () => {
                        const newName = prompt("Edit cart name:", cart.name);
                        if (newName && newName.trim() && newName !== cart.name) {
                          setLocalCarts(localCarts.map((c) => c.id === cart.id ? { ...c, name: newName.trim() } : c));
                          await onAddCart(`__edit__${cart.id}__${newName.trim()}`);
                        }
                      }}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                  </div>
                </div>
                <ul>
                  {cart.items.map((item) => (
                    <li key={item.productId} style={{ color: '#0E62A0', fontWeight: 600 }}>
                      {item.productName} - {item.quantity} (Added by: {item.addedBy})
                    </li>
                  ))}
                </ul>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {clientProducts.map((product) => (
                    <div
                      key={product.id}
                      className="card shadow-sm p-2 align-items-center justify-content-center"
                      style={{
                        minWidth: 120,
                        maxWidth: 160,
                        background: '#e3f2fd',
                        border: '1px solid #b3c6e0',
                        cursor: 'pointer',
                        transition: 'border 0.18s',
                        marginBottom: 8,
                      }}
                      onClick={() => {
                        setShowProductKeypad({ cartId: cart.id, productId: product.id });
                        setKeypadQty("");
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#0E62A0' }}>{product.name}</div>
                    </div>
                  ))}
                </div>
                {/* Product Keypad Modal */}
                {showProductKeypad && showProductKeypad.cartId === cart.id && (
                  <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <div className="modal-dialog" style={{ maxWidth: 320 }}>
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">Add Quantity</h5>
                          <button type="button" className="btn-close" onClick={() => setShowProductKeypad(null)}></button>
                        </div>
                        <div className="modal-body text-center">
                          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
                            {clientProducts.find(p => p.id === showProductKeypad.productId)?.name}
                          </div>
                          <input
                            type="number"
                            min={1}
                            className="form-control mb-3"
                            style={{ fontSize: 22, textAlign: 'center', width: 120, margin: '0 auto' }}
                            value={keypadQty}
                            onChange={e => setKeypadQty(e.target.value.replace(/[^0-9]/g, ""))}
                            autoFocus
                          />
                          <div className="d-flex flex-wrap justify-content-center">
                            {[1,2,3,4,5,6,7,8,9,0].map((num) => (
                              <button
                                key={num}
                                className="btn btn-light m-1"
                                style={{ width: 60, height: 48, fontSize: 22, fontWeight: 600 }}
                                onClick={() => setKeypadQty(q => q === "0" ? String(num) : q + String(num))}
                              >
                                {num}
                              </button>
                            ))}
                            <button
                              className="btn btn-light m-1"
                              style={{ width: 60, height: 48, fontSize: 22, fontWeight: 600 }}
                              onClick={() => setKeypadQty(q => q.length > 0 ? q.slice(0, -1) : "")}
                            >
                              ←
                            </button>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button className="btn btn-secondary" onClick={() => setShowProductKeypad(null)}>Cancel</button>
                          <button
                            className="btn btn-success"
                            disabled={keypadQty === "" || Number(keypadQty) < 1}
                            onClick={() => {
                              const qty = Number(keypadQty);
                              if (qty < 1) return;
                              setLocalCarts((prevCarts) => prevCarts.map((c) => {
                                if (c.id !== cart.id) return c;
                                const existingIdx = c.items.findIndex((item) => item.productId === showProductKeypad.productId);
                                let newItems;
                                if (existingIdx > -1) {
                                  newItems = c.items.map((item, idx) =>
                                    idx === existingIdx
                                      ? { ...item, quantity: (Number(item.quantity) || 0) + qty }
                                      : item
                                  );
                                } else {
                                  const prod = clientProducts.find(p => p.id === showProductKeypad.productId);
                                  newItems = [
                                    ...c.items,
                                    {
                                      productId: showProductKeypad.productId,
                                      productName: prod ? prod.name : '',
                                      quantity: qty,
                                      price: prod ? prod.price : 0,
                                      addedBy: 'You',
                                    },
                                  ];
                                }
                                return { ...c, items: newItems };
                              }));
                              onAddProductToCart(cart.id, showProductKeypad.productId, qty);
                              setShowProductKeypad(null);
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailsModal;
