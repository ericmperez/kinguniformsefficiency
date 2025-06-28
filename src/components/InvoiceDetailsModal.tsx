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

  // Determine delivery timestamp (lockedAt, verifiedAt, or deliveredAt if present)
  const deliveryTimestamp = invoice.lockedAt || invoice.verifiedAt || (invoice as any).deliveredAt || null;

  // Helper to check if item was added after delivery
  function isItemAddedAfterDelivery(item: any) {
    if (!deliveryTimestamp || !item.addedAt) return false;
    return new Date(item.addedAt).getTime() > new Date(deliveryTimestamp).getTime();
  }

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
            {/* Show verifier if present */}
            {invoice.verifiedBy && (
              <h6 className="text-success">Verificado por: {invoice.verifiedBy}</h6>
            )}
            <h6>Total Carts: {invoice.carts.length}</h6>
            {/* Show group weight if available on invoice or client */}
            {typeof invoice.totalWeight === 'number' && (
              <h6 className="text-success">Group Weight: {invoice.totalWeight} lbs</h6>
            )}
            {client && typeof (client as any).groupWeight === 'number' && !invoice.totalWeight && (
              <h6 className="text-success">Group Weight: {(client as any).groupWeight} lbs</h6>
            )}
            {/* Show verification status and verifier if present */}
            {(invoice.verified || invoice.partiallyVerified) && (
              <div className="mb-2">
                <span className={invoice.verified ? 'badge bg-success' : 'badge bg-warning text-dark'}>
                  {invoice.verified ? 'Fully Verified' : 'Partially Verified'}
                </span>
                {invoice.verifiedBy && (
                  <span className="ms-2 text-secondary">Verifier: {invoice.verifiedBy}</span>
                )}
              </div>
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
              <div key={cart.id} className="cart-section mb-4 p-2 border rounded" style={{background: '#f8fafc', boxShadow: '0 2px 8px #e0e7ef'}}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <h3 style={{ fontWeight: 800, color: '#0E62A0', marginBottom: 8 }}>CART #{cart.name}</h3>
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
                {/* Add New Item Button */}
                <div className="mb-2">
                  <button
                    className="btn btn-link text-primary fw-bold"
                    style={{fontSize: 18, textDecoration: 'none'}}
                    onClick={() => setAddProductCartId(cart.id)}
                  >
                    + Add New Item
                  </button>
                </div>
                {/* Product Cards Modal for Adding Product */}
                {addProductCartId === cart.id && (
                  <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <div className="modal-dialog" style={{ maxWidth: 600 }}>
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">Add Product</h5>
                          <button type="button" className="btn-close" onClick={() => setAddProductCartId(null)}></button>
                        </div>
                        <div className="modal-body">
                          <div className="row g-3">
                            {clientProducts.map((product) => (
                              <div key={product.id} className="col-12 col-md-4">
                                <div
                                  className={`card mb-2 shadow-sm h-100${selectedProductId === product.id ? " border-primary" : " border-light"}`}
                                  style={{ cursor: "pointer", minHeight: 120, borderWidth: 2 }}
                                  onClick={() => setSelectedProductId(product.id)}
                                >
                                  {product.imageUrl && (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8 }}
                                    />
                                  )}
                                  <div className="card-body py-2 px-3 text-center">
                                    <div className="fw-bold" style={{ fontSize: 18 }}>{product.name}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3">
                            <label className="form-label">Quantity</label>
                            <input
                              type="number"
                              className="form-control"
                              min={1}
                              value={productQty}
                              onChange={e => setProductQty(Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button className="btn btn-secondary" onClick={() => setAddProductCartId(null)}>Cancel</button>
                          <button
                            className="btn btn-primary"
                            disabled={!selectedProductId || productQty < 1}
                            onClick={() => {
                              onAddProductToCart(cart.id, selectedProductId, productQty);
                              setAddProductCartId(null);
                              setSelectedProductId("");
                              setProductQty(1);
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Product Cards */}
                <div className="row g-2 mb-2">
                  {/* Group items by productId, but keep each entry, and show as a single card with icon, name, total, and per-entry breakdown */}
                  {(() => {
                    // Group items by productId
                    const itemsByProduct: Record<string, Array<typeof cart.items[0]>> = {};
                    cart.items.forEach(item => {
                      if (!itemsByProduct[item.productId]) itemsByProduct[item.productId] = [];
                      itemsByProduct[item.productId].push(item);
                    });
                    // Helper: get icon for product (fallback to placeholder)
                    const getProductIcon = (product: Product | undefined) => {
                      if (!product) return <span role="img" aria-label="product">🖼️</span>;
                      const name = product.name.toLowerCase();
                      if (name.includes("scrub shirt") || name.includes("scrub top") || name.includes("scrub")) {
                        return (
                          <img
                            src={"/images/products/scrubshirt.png"}
                            alt="Scrub Shirt"
                            style={{ width: 40, height: 40, objectFit: 'contain' }}
                          />
                        );
                      }
                      if (name.includes("sábanas")) return <span role="img" aria-label="sheets">🛏️</span>;
                      if (name.includes("fundas")) return <span role="img" aria-label="covers">🧺</span>;
                      if (name.includes("toallas de baño")) return <span role="img" aria-label="bath towel">🛁</span>;
                      if (name.includes("toalla de piso")) return <span role="img" aria-label="floor towel">🧍</span>;
                      if (name.includes("toalla de cara")) return <span role="img" aria-label="face towel">🧻</span>;
                      if (name.includes("frisas")) return <span role="img" aria-label="frisas">🦢</span>;
                      if (name.includes("cortinas")) return <span role="img" aria-label="curtains">🪟</span>;
                      return <span role="img" aria-label="product">🖼️</span>;
                    };
                    return Object.entries(itemsByProduct).map(([productId, entries]) => {
                      const product = clientProducts.find(p => p.id === productId);
                      const totalQty = entries.reduce((sum, e) => sum + Number(e.quantity), 0);
                      return (
                        <div key={productId} className="col-12 col-md-6">
                          <div className="d-flex align-items-center border rounded p-2 mb-2" style={{background: '#fff', minHeight: 72}}>
                            <div style={{width: 48, height: 48, marginRight: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32}}>
                              {getProductIcon(product)}
                            </div>
                            <div style={{flex: 1}}>
                              <div style={{fontWeight: 700, fontSize: 18, color: '#222'}}>{entries[0].productName}</div>
                              <div style={{fontSize: 13, color: '#888'}}>
                                Added by {entries[0].addedBy || 'You'}
                              </div>
                            </div>
                            <div style={{fontWeight: 700, fontSize: 22, color: '#0E62A0', marginLeft: 8, minWidth: 60, textAlign: 'right'}}>{totalQty}</div>
                          </div>
                          {/* Per-entry breakdown */}
                          {entries.length > 1 && (
                            <div style={{marginLeft: 60, fontSize: 13, color: '#888', marginTop: -8, marginBottom: 8}}>
                              {entries.map((entry, idx) => (
                                <span key={idx} style={{marginRight: 8}}>+{entry.quantity}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailsModal;
