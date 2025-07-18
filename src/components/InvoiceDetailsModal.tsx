import React from "react";
import { Invoice, Product, Client, Cart, LaundryCart } from "../types";
import { getUsers, UserRecord, logActivity } from "../services/firebaseService";
import { useAuth } from "./AuthContext";

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
  client: Client | undefined;
  products: Product[];
  onAddCart: (cartName: string) => Promise<LaundryCart>;
  onAddProductToCart: (
    cartId: string,
    productId: string,
    quantity: number,
    price?: number,
    itemIdx?: number
  ) => void;
  refreshInvoices?: () => Promise<void>;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  invoice,
  onClose,
  client,
  products,
  onAddCart,
  onAddProductToCart,
  refreshInvoices,
}) => {
  const [newCartName, setNewCartName] = React.useState("");
  const [addProductCartId, setAddProductCartId] = React.useState<string | null>(
    null
  );
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [productQty, setProductQty] = React.useState(1);
  const [showNewCartInput, setShowNewCartInput] = React.useState(false);
  const [showCartKeypad, setShowCartKeypad] = React.useState(false);
  const [showProductKeypad, setShowProductKeypad] = React.useState<null | {
    cartId: string;
    productId: string;
  }>(null);
  const [keypadQty, setKeypadQty] = React.useState<string>("");

  // Local state for carts to enable instant UI update
  const [localCarts, setLocalCarts] = React.useState(invoice.carts);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const { user } = useAuth();

  // --- Invoice Name Editing ---
  const [editingInvoiceName, setEditingInvoiceName] = React.useState(false);
  const [invoiceName, setInvoiceName] = React.useState(invoice.name || "");
  const [savingInvoiceName, setSavingInvoiceName] = React.useState(false);

  // Sync local carts with invoice changes
  React.useEffect(() => {
    setLocalCarts(invoice.carts);
  }, [invoice.carts]);

  React.useEffect(() => {
    getUsers().then(setUsers);
  }, []);

  React.useEffect(() => {
    setInvoiceName(invoice.name || "");
  }, [invoice.name]);

  const getVerifierName = (verifierId: string) => {
    if (!verifierId) return "-";
    const found = users.find(
      (u) => u.id === verifierId || u.username === verifierId
    );
    if (found) return found.username;
    if (verifierId.length > 4 || /[a-zA-Z]/.test(verifierId)) return verifierId;
    return verifierId;
  };

  // Get only products associated with this client
  const clientProducts = React.useMemo(() => {
    if (!client) return [];
    return products.filter((p) => client.selectedProducts.includes(p.id));
  }, [client, products]);

  // Determine delivery timestamp (lockedAt, verifiedAt, or deliveredAt if present)
  const deliveryTimestamp =
    invoice.lockedAt ||
    invoice.verifiedAt ||
    (invoice as any).deliveredAt ||
    null;

  // Helper to check if item was added after delivery
  function isItemAddedAfterDelivery(item: any) {
    if (!deliveryTimestamp || !item.addedAt) return false;
    return (
      new Date(item.addedAt).getTime() > new Date(deliveryTimestamp).getTime()
    );
  }

  // Helper: keypad buttons
  const keypadButtons = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
    "←",
    "OK",
  ];

  // Save invoice name to Firestore
  const handleSaveInvoiceName = async () => {
    if (!invoiceName.trim() || invoiceName === invoice.name) {
      setEditingInvoiceName(false);
      return;
    }
    setSavingInvoiceName(true);
    try {
      // Use onAddCart with special key to trigger invoice name update
      if (typeof onAddCart === "function") {
        // This is a hack: pass a special string to onAddCart to trigger invoice name update in parent
        await onAddCart(`__invoice_name__${invoiceName.trim()}`);
      }
      if (refreshInvoices) await refreshInvoices();
    } finally {
      setSavingInvoiceName(false);
      setEditingInvoiceName(false);
    }
  };

  // Handler to delete a product from a cart
  const handleDeleteCartItem = async (
    cartId: string,
    productId: string,
    itemIdx: number
  ) => {
    const updatedCarts = localCarts.map((cart) => {
      if (cart.id !== cartId) return cart;
      return {
        ...cart,
        items: cart.items.filter(
          (item, idx) => !(item.productId === productId && idx === itemIdx)
        ),
      };
    });
    setLocalCarts(updatedCarts);
    // Persist change
    await onAddProductToCart(cartId, productId, 0, undefined, itemIdx);
    if (refreshInvoices) await refreshInvoices();
  };

  // Add logActivity to cart creation (new cart and default cart)
  const handleAddCart = async (cartName: string) => {
    const newCart: LaundryCart = await onAddCart(cartName);
    if (typeof logActivity === "function") {
      await logActivity({
        type: "Cart",
        message: `Cart '${cartName}' created in invoice '${
          invoice.name || invoice.invoiceNumber
        }'`,
        user: user?.username,
      });
    }
    return newCart;
  };

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
      onClick={(e) => {
        // Only close if the click is on the overlay, not inside the modal-dialog
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-dialog modal-lg"
        style={{
          margin: "auto",
          maxWidth: 800,
          width: "100%",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Invoice #{invoice.invoiceNumber}
              {editingInvoiceName ? (
                <span style={{ marginLeft: 16 }}>
                  <input
                    type="text"
                    className="form-control d-inline-block"
                    style={{ width: 220, display: "inline-block" }}
                    value={invoiceName}
                    onChange={(e) => setInvoiceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveInvoiceName();
                      if (e.key === "Escape") setEditingInvoiceName(false);
                    }}
                    autoFocus
                    disabled={savingInvoiceName}
                  />
                  <button
                    className="btn btn-success btn-sm ms-2"
                    onClick={handleSaveInvoiceName}
                    disabled={savingInvoiceName || !invoiceName.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-secondary btn-sm ms-2"
                    onClick={() => setEditingInvoiceName(false)}
                    disabled={savingInvoiceName}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <>
                  {invoice.name && (
                    <span
                      style={{
                        marginLeft: 16,
                        fontWeight: 600,
                        color: "#0E62A0",
                        fontSize: 18,
                      }}
                    >
                      {invoice.name}
                    </span>
                  )}
                  <button
                    className="btn btn-outline-primary btn-sm ms-2"
                    title="Edit Invoice Name"
                    onClick={() => setEditingInvoiceName(true)}
                  >
                    <i className="bi bi-pencil" />
                  </button>
                </>
              )}
            </h5>
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
              <h6 className="text-success">
                Verificado por: {getVerifierName(invoice.verifiedBy)}
                {invoice.verifiedAt && (
                  <span
                    style={{ marginLeft: 12, color: "#888", fontWeight: 500 }}
                  >
                    ({new Date(invoice.verifiedAt).toLocaleString()})
                  </span>
                )}
              </h6>
            )}
            <h6>Total Carts: {invoice.carts.length}</h6>
            {/* Show group weight if available on invoice or client */}
            {typeof invoice.totalWeight === "number" && (
              <h6 className="text-success">
                Group Weight: {invoice.totalWeight} lbs
              </h6>
            )}
            {client &&
              typeof (client as any).groupWeight === "number" &&
              !invoice.totalWeight && (
                <h6 className="text-success">
                  Group Weight: {(client as any).groupWeight} lbs
                </h6>
              )}
            {/* Show verification status and verifier if present */}
            {(invoice.verified || invoice.partiallyVerified) && (
              <div className="mb-2">
                <span
                  className={
                    invoice.verified
                      ? "badge bg-success"
                      : "badge bg-warning text-dark"
                  }
                >
                  {invoice.verified ? "Fully Verified" : "Partially Verified"}
                </span>
                {invoice.verifiedBy && (
                  <span className="ms-2 text-secondary">
                    Verifier: {getVerifierName(invoice.verifiedBy)}
                    {invoice.verifiedAt && (
                      <span style={{ marginLeft: 8 }}>
                        ({new Date(invoice.verifiedAt).toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
            
            {/* Special Service Delivery Section */}
            <div className="mb-3 p-3 border rounded" style={{ backgroundColor: "#f8f9fa" }}>
              <h6 className="mb-3" style={{ color: "#0E62A0", fontWeight: "bold" }}>
                Special Service Delivery
              </h6>
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="specialServiceRequested"
                  checked={invoice.specialServiceRequested || false}
                  onChange={async (e) => {
                    const isChecked = e.target.checked;
                    await onAddCart(`__special_service__${isChecked}`);
                    if (refreshInvoices) await refreshInvoices();
                  }}
                />
                <label className="form-check-label" htmlFor="specialServiceRequested" style={{ fontWeight: "600" }}>
                  Special Service Delivery Requested
                </label>
              </div>
            </div>
            <div className="mb-3">
              {!showNewCartInput ? (
                <>
                  <button
                    className="btn btn-primary me-2"
                    onClick={() => {
                      setShowNewCartInput(true);
                      setShowCartKeypad(true);
                      setNewCartName("");
                    }}
                  >
                    Create New Cart
                  </button>
                </>
              ) : (
                <div className="d-flex gap-2 align-items-center">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="New Cart Name"
                    value={newCartName}
                    readOnly
                    style={{ background: "#f8fafc", cursor: "pointer" }}
                    onFocus={() => setShowCartKeypad(true)}
                    onClick={() => setShowCartKeypad(true)} // Ensure keypad shows on click as well
                  />
                  <button
                    className="btn btn-success"
                    onClick={async () => {
                      if (newCartName.trim()) {
                        const newCart: LaundryCart = await handleAddCart(
                          newCartName.trim()
                        );
                        setLocalCarts([
                          ...localCarts,
                          {
                            id: newCart.id,
                            name: newCart.name,
                            items: [],
                            total: 0,
                            createdAt: new Date().toISOString(),
                          },
                        ]);
                        setNewCartName("");
                        setShowNewCartInput(false);
                        setShowCartKeypad(false);
                        if (refreshInvoices) await refreshInvoices();
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
                <div
                  className="modal show d-block"
                  tabIndex={-1}
                  style={{ background: "rgba(0,0,0,0.25)", zIndex: 2000 }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowCartKeypad(false);
                  }}
                >
                  <div
                    className="modal-dialog"
                    style={{ maxWidth: 320, margin: "120px auto" }}
                  >
                    <div className="modal-content">
                      <div className="modal-header">
                        <h5 className="modal-title">Enter Cart Name</h5>
                        <button
                          type="button"
                          className="btn-close"
                          onClick={() => setShowCartKeypad(false)}
                        ></button>
                      </div>
                      <div className="modal-body">
                        <input
                          type="text"
                          className="form-control mb-3 text-center"
                          value={newCartName}
                          readOnly
                          style={{
                            fontSize: 28,
                            letterSpacing: 2,
                            background: "#f8fafc",
                          }}
                        />
                        <div className="d-flex flex-wrap justify-content-center">
                          {keypadButtons.map((btn, idx) => (
                            <button
                              key={btn + idx}
                              className="btn btn-light m-1"
                              style={{
                                width: 60,
                                height: 48,
                                fontSize: 22,
                                fontWeight: 600,
                              }}
                              onClick={async () => {
                                if (btn === "OK") {
                                  if (newCartName.trim()) {
                                    const newCart: LaundryCart =
                                      await handleAddCart(newCartName.trim());
                                    setLocalCarts([
                                      ...localCarts,
                                      {
                                        id: newCart.id,
                                        name: newCart.name,
                                        items: [],
                                        total: 0,
                                        createdAt: new Date().toISOString(),
                                      },
                                    ]);
                                    setNewCartName("");
                                    setShowNewCartInput(false);
                                    setShowCartKeypad(false);
                                    if (refreshInvoices)
                                      await refreshInvoices();
                                  } else {
                                    setShowCartKeypad(false);
                                  }
                                } else if (btn === "←") {
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
                    </div>
                  </div>
                </div>
              )}
            </div>
            {localCarts.map((cart) => (
              <div
                key={cart.id}
                className="cart-section mb-4 p-2 border rounded"
                style={{
                  background: "#bae6fd", // Darker blue background
                  boxShadow: "0 2px 12px #60a5fa",
                  borderLeft: "6px solid #0ea5e9",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <h3
                      style={{
                        fontWeight: 800,
                        color: cart.name
                          .toUpperCase()
                          .startsWith("CARRO SIN NOMBRE")
                          ? "red"
                          : "#0E62A0",
                        marginBottom: 8,
                      }}
                    >
                      {cart.name}
                    </h3>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-danger btn-sm"
                      title="Delete Cart"
                      onClick={async () => {
                        if (window.confirm(`Delete cart '${cart.name}'?`)) {
                          setLocalCarts(
                            localCarts.filter((c) => c.id !== cart.id)
                          );
                          await onAddCart("__delete__" + cart.id);
                          if (typeof logActivity === "function") {
                            await logActivity({
                              type: "Cart",
                              message: `Cart '${
                                cart.name
                              }' deleted from invoice '${
                                invoice.name || invoice.invoiceNumber
                              }'`,
                              user: user?.username,
                            });
                          }
                          if (refreshInvoices) await refreshInvoices();
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
                        if (
                          newName &&
                          newName.trim() &&
                          newName !== cart.name
                        ) {
                          setLocalCarts(
                            localCarts.map((c) =>
                              c.id === cart.id
                                ? { ...c, name: newName.trim() }
                                : c
                            )
                          );
                          await onAddCart(
                            `__edit__${cart.id}__${newName.trim()}`
                          );
                          if (typeof logActivity === "function") {
                            await logActivity({
                              type: "Cart",
                              message: `Cart '${
                                cart.name
                              }' renamed to '${newName.trim()}' in invoice '${
                                invoice.name || invoice.invoiceNumber
                              }'`,
                              user: user?.username,
                            });
                          }
                          if (refreshInvoices) await refreshInvoices();
                          // Sync localCarts with latest invoice.carts after refresh
                          setLocalCarts(
                            typeof invoice.carts === "object"
                              ? [...invoice.carts]
                              : []
                          );
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
                    style={{
                      fontSize: 28,
                      textDecoration: "none",
                      padding: "18px 0",
                      width: "100%",
                      display: "block",
                      background: "#eaf4ff",
                      borderRadius: 12,
                      border: "2.5px dashed #0E62A0",
                      fontWeight: 900,
                      letterSpacing: 1,
                      boxShadow: "0 2px 12px rgba(14,98,160,0.08)",
                      margin: "18px 0",
                    }}
                    onClick={() => setAddProductCartId(cart.id)}
                  >
                    + Add New Item
                  </button>
                </div>
                {/* Product Cards Modal for Adding Product */}
                {addProductCartId === cart.id && (
                  <div
                    className="modal show d-block"
                    style={{ background: "rgba(0,0,0,0.15)" }}
                  >
                    <div className="modal-dialog" style={{ maxWidth: 600 }}>
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">Add Product</h5>
                          <button
                            type="button"
                            className="btn-close"
                            onClick={() => {
                              setAddProductCartId(null);
                              setSelectedProductId("");
                              setKeypadQty("");
                            }}
                          ></button>
                        </div>
                        <div className="modal-body">
                          <div className="row g-3">
                            {clientProducts.map((product) => (
                              <div key={product.id} className="col-12 col-md-4">
                                <div
                                  className={`card mb-2 shadow-sm h-100${
                                    selectedProductId === product.id
                                      ? " border-primary"
                                      : " border-light"
                                  }`}
                                  style={{
                                    cursor: "pointer",
                                    minHeight: 120,
                                    borderWidth: 2,
                                  }}
                                  onClick={() => {
                                    setSelectedProductId(product.id);
                                    setShowProductKeypad({
                                      cartId: cart.id,
                                      productId: product.id,
                                    });
                                    setKeypadQty("");
                                  }}
                                >
                                  {product.imageUrl && (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      style={{
                                        width: "100%",
                                        height: 90,
                                        objectFit: "cover",
                                        borderRadius: 8,
                                      }}
                                    />
                                  )}
                                  <div className="card-body py-2 px-3 text-center">
                                    <div
                                      className="fw-bold"
                                      style={{ fontSize: 18 }}
                                    >
                                      {product.name}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Product quantity keypad modal */}
                {showProductKeypad && (
                  <div
                    className="modal show d-block"
                    tabIndex={-1}
                    style={{ background: "rgba(0,0,0,0.25)", zIndex: 2100 }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget)
                        setShowProductKeypad(null);
                    }}
                  >
                    <div
                      className="modal-dialog"
                      style={{ maxWidth: 320, margin: "120px auto" }}
                    >
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">Enter Quantity</h5>
                          <button
                            type="button"
                            className="btn-close"
                            onClick={() => setShowProductKeypad(null)}
                          ></button>
                        </div>
                        <div className="modal-body">
                          <input
                            type="text"
                            className="form-control mb-3 text-center"
                            value={keypadQty}
                            readOnly
                            style={{
                              fontSize: 28,
                              letterSpacing: 2,
                              background: "#f8fafc",
                            }}
                          />
                          <div className="d-flex flex-wrap justify-content-center">
                            {keypadButtons.map((btn, idx) => (
                              <button
                                key={btn + idx}
                                className="btn btn-light m-1"
                                style={{
                                  width: 60,
                                  height: 48,
                                  fontSize: 22,
                                  fontWeight: 600,
                                }}
                                onClick={async () => {
                                  if (btn === "OK") {
                                    const qty = parseInt(keypadQty, 10);
                                    if (showProductKeypad && qty > 0) {
                                      // 1. Update localCarts immediately for instant UI update
                                      setLocalCarts((prevCarts) =>
                                        prevCarts.map((cartObj) => {
                                          if (
                                            cartObj.id !==
                                            showProductKeypad.cartId
                                          )
                                            return cartObj;
                                          const prod = clientProducts.find(
                                            (p) =>
                                              p.id ===
                                              showProductKeypad.productId
                                          );
                                          return {
                                            ...cartObj,
                                            items: [
                                              ...cartObj.items,
                                              {
                                                productId:
                                                  showProductKeypad.productId,
                                                productName: prod
                                                  ? prod.name
                                                  : "",
                                                quantity: qty,
                                                price: prod ? prod.price : 0,
                                                addedBy:
                                                  user?.username || "You",
                                                addedAt:
                                                  new Date().toISOString(),
                                              },
                                            ],
                                          };
                                        })
                                      );
                                      // 2. Persist to Firestore (parent handler)
                                      await onAddProductToCart(
                                        showProductKeypad.cartId,
                                        showProductKeypad.productId,
                                        qty
                                      );
                                      if (refreshInvoices)
                                        await refreshInvoices();
                                      setAddProductCartId(null);
                                      setSelectedProductId("");
                                      setShowProductKeypad(null);
                                      setKeypadQty("");
                                    } else {
                                      setShowProductKeypad(null);
                                      setKeypadQty("");
                                    }
                                  } else if (btn === "←") {
                                    setKeypadQty((prev) => prev.slice(0, -1));
                                  } else {
                                    setKeypadQty((prev) => prev + btn);
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
                      </div>
                    </div>
                  </div>
                )}
                {/* Product summary cards */}
                <div className="row g-2 mb-2">
                  {clientProducts
                    .filter((prod) =>
                      cart.items.some((i) => i.productId === prod.id)
                    )
                    .map((product) => {
                      // All entries for this product in this cart
                      const entries = cart.items
                        .map((item, idx) => ({ ...item, idx }))
                        .filter((item) => item.productId === product.id);
                      const totalQty = entries.reduce(
                        (sum, item) => sum + Number(item.quantity),
                        0
                      );
                      return (
                        <div key={product.id} className="col-12 col-md-6">
                          <div
                            className="d-flex flex-column border rounded p-2 mb-1"
                            style={{ background: "#fff", minHeight: 72 }}
                          >
                            <div className="d-flex align-items-center mb-2">
                              <div
                                style={{
                                  width: 48,
                                  height: 48,
                                  marginRight: 12,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 32,
                                }}
                              >
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    style={{
                                      width: 40,
                                      height: 40,
                                      objectFit: "contain",
                                    }}
                                  />
                                ) : (
                                  (() => {
                                    const name = product.name.toLowerCase();
                                    if (
                                      name.includes("scrub shirt") ||
                                      name.includes("scrub top") ||
                                      name.includes("scrub")
                                    )
                                      return (
                                        <img
                                          src="/images/products/scrubshirt.png"
                                          alt="Scrub Shirt"
                                          style={{
                                            width: 40,
                                            height: 40,
                                            objectFit: "contain",
                                          }}
                                        />
                                      );
                                    if (name.includes("sábanas"))
                                      return (
                                        <span role="img" aria-label="sheets">
                                          🛏️
                                        </span>
                                      );
                                    if (name.includes("fundas"))
                                      return (
                                        <span role="img" aria-label="covers">
                                          🧺
                                        </span>
                                      );
                                    if (name.includes("toallas de baño"))
                                      return (
                                        <span
                                          role="img"
                                          aria-label="bath towel"
                                        >
                                          🛁
                                        </span>
                                      );
                                    if (name.includes("toalla de piso"))
                                      return (
                                        <span
                                          role="img"
                                          aria-label="floor towel"
                                        >
                                          🧍
                                        </span>
                                      );
                                    if (name.includes("toalla de cara"))
                                      return (
                                        <span
                                          role="img"
                                          aria-label="face towel"
                                        >
                                          🧻
                                        </span>
                                      );
                                    if (name.includes("frisas"))
                                      return (
                                        <span role="img" aria-label="frisas">
                                          🦢
                                        </span>
                                      );
                                    if (name.includes("cortinas"))
                                      return (
                                        <span role="img" aria-label="curtains">
                                          🪟
                                        </span>
                                      );
                                    return (
                                      <span role="img" aria-label="product">
                                        🖼️
                                      </span>
                                    );
                                  })()
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 18,
                                    color: "#222",
                                  }}
                                >
                                  {product.name}
                                </div>
                              </div>
                            </div>
                            {/* List each entry for this product in this cart */}
                            <div
                              style={{
                                fontSize: 14,
                                color: "#444",
                                marginBottom: 4,
                              }}
                            >
                              {entries.map((item, i) => (
                                <div
                                  key={item.idx}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "2px 0",
                                    borderBottom: "1px solid #f0f0f0",
                                  }}
                                >
                                  <span>
                                    +{item.quantity} by{" "}
                                    {item.addedBy || "Unknown"}
                                    {item.addedAt && (
                                      <span
                                        style={{
                                          color: "#888",
                                          marginLeft: 6,
                                          fontSize: 12,
                                        }}
                                      >
                                        {new Date(
                                          item.addedAt
                                        ).toLocaleString()}
                                      </span>
                                    )}
                                    {item.editedBy && (
                                      <span
                                        style={{
                                          color: "#0ea5e9",
                                          marginLeft: 8,
                                          fontSize: 12,
                                        }}
                                      >
                                        (edited by {item.editedBy})
                                      </span>
                                    )}
                                  </span>
                                  <span>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      style={{
                                        padding: "2px 8px",
                                        fontSize: 12,
                                      }}
                                      onClick={() =>
                                        handleDeleteCartItem(
                                          cart.id,
                                          product.id,
                                          item.idx
                                        )
                                      }
                                      title="Delete entry"
                                    >
                                      <i className="bi bi-x" />
                                    </button>
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Total for this product */}
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 18,
                                color: "#0E62A0",
                                textAlign: "right",
                              }}
                            >
                              Total: {totalQty}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
