import React, { useState } from "react";
import { Client, Product, Invoice, CartItem, Cart } from "../types";
import InvoiceForm from "./InvoiceForm";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

interface ActiveInvoicesProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  onAddInvoice: (invoice: Omit<Invoice, "id">) => Promise<void>;
  onDeleteInvoice: (invoiceId: string) => Promise<void>;
  onUpdateInvoice: (
    invoiceId: string,
    updatedInvoice: Partial<Invoice>
  ) => Promise<void>;
}

// Utility to sanitize cart items before updating invoice
function sanitizeCartItem(item: any) {
  return {
    ...item,
    price:
      typeof item.price === "number" && !isNaN(item.price) ? item.price : 0,
    quantity:
      typeof item.quantity === "number" && !isNaN(item.quantity)
        ? item.quantity
        : 1,
    addedBy: typeof item.addedBy === "string" ? item.addedBy : "",
  };
}

export default function ActiveInvoices({
  clients,
  products,
  invoices,
  onAddInvoice,
  onDeleteInvoice,
  onUpdateInvoice,
}: ActiveInvoicesProps) {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [showNewCartForm, setShowNewCartForm] = useState(false);
  const [newCartName, setNewCartName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [hoveredInvoiceId, setHoveredInvoiceId] = useState<string | null>(null);
  const [isCreatingCart, setIsCreatingCart] = useState(false);
  const [showProductKeypad, setShowProductKeypad] = useState(false);
  const [productForKeypad, setProductForKeypad] = useState<Product | null>(
    null
  );
  const [keypadQuantity, setKeypadQuantity] = useState(1);
  const [doneInvoices, setDoneInvoices] = useState<string[]>([]);

  // Placeholder for current user. Replace with actual user logic as needed.
  const currentUser = "Current User";

  const handleAddInvoice = () => {
    setShowInvoiceForm(true);
  };

  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setShowCartModal(true);
    setShowNewCartForm(true); // This ensures the cart list is shown
    setIsCreatingCart(false);
  };

  const handleSelectCart = (cartId: string) => {
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    const selectedCart = invoice?.carts.find((cart) => cart.id === cartId);
    if (selectedCart) {
      setCartItems(selectedCart.items);
      setNewCartName(selectedCart.name);
      setShowNewCartForm(false);
    }
  };

  const handleCreateNewCart = () => {
    setIsCreatingCart(true);
    setCartItems([]);
    setNewCartName("");
  };

  const handleSaveNewCart = async () => {
    if (selectedInvoiceId && newCartName.trim()) {
      try {
        const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
        const newCart: Cart = {
          id: Date.now().toString(), // Temporary ID, will be replaced by Firebase
          name: newCartName.trim(),
          items: [],
          total: 0,
          createdAt: new Date().toISOString(),
        };

        await onUpdateInvoice(selectedInvoiceId, {
          carts: [
            ...(invoice?.carts || []),
            { ...newCart, items: newCart.items.map(sanitizeCartItem) },
          ],
        });

        setShowCartModal(false);
        setSelectedInvoiceId(null);
        setNewCartName("");
        setShowNewCartForm(false);
        setIsCreatingCart(false);
        setCartItems([]);
      } catch (error) {
        console.error("Error creating cart:", error);
        alert("Error creating cart. Please try again.");
      }
    }
  };

  const handleAddToCart = () => {
    if (selectedProduct && quantity > 0) {
      const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
      const client = clients.find((c) => c.id === invoice?.clientId);
      const product = products.find((p) => p.id === selectedProduct);

      if (product && client) {
        const existingItem = cartItems.find(
          (item) => item.productId === selectedProduct
        );
        if (existingItem) {
          setCartItems(
            cartItems.map((item) =>
              item.productId === selectedProduct
                ? {
                    ...item,
                    quantity: item.quantity + quantity,
                    addedAt: new Date().toISOString(),
                  }
                : item
            )
          );
        } else {
          setCartItems([
            ...cartItems,
            {
              productId: product.id,
              productName: product.name,
              quantity,
              price: product.price,
              addedBy: currentUser,
              addedAt: new Date().toISOString(),
            },
          ]);
        }
        setSelectedProduct("");
        setQuantity(1);
      }
    }
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems(cartItems.filter((item) => item.productId !== productId));
  };

  const handleCartAssign = async () => {
    if (selectedInvoiceId && newCartName.trim()) {
      try {
        const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
        const updatedCart: Cart = {
          id: Date.now().toString(),
          name: newCartName.trim(),
          items: cartItems.map(sanitizeCartItem),
          total: 0, // Total calculation removed
          createdAt: new Date().toISOString(),
        };

        await onUpdateInvoice(selectedInvoiceId, {
          carts: [...(invoice?.carts || []), updatedCart],
        });

        setShowCartModal(false);
        setSelectedInvoiceId(null);
        setNewCartName("");
        setShowNewCartForm(false);
        setCartItems([]);
      } catch (error) {
        console.error("Error assigning cart:", error);
        alert("Error assigning cart to invoice. Please try again.");
      }
    }
  };

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
  };

  const handleConfirmDelete = async () => {
    if (invoiceToDelete) {
      await onDeleteInvoice(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };

  const handleProductCardClick = (product: Product) => {
    setProductForKeypad(product);
    setKeypadQuantity(1);
    setShowProductKeypad(true);
  };

  const handleKeypadAdd = async () => {
    if (productForKeypad && keypadQuantity > 0) {
      setCartItems((prev) => {
        const existing = prev.find(
          (item) => item.productId === productForKeypad.id
        );
        let newCartItems;
        if (existing) {
          newCartItems = prev.map((item) =>
            item.productId === productForKeypad.id
              ? {
                  ...item,
                  quantity: item.quantity + keypadQuantity,
                  addedAt: new Date().toISOString(),
                }
              : item
          );
        } else {
          newCartItems = [
            ...prev,
            {
              productId: productForKeypad.id,
              productName: productForKeypad.name,
              quantity: keypadQuantity,
              price: productForKeypad.price,
              addedBy: currentUser,
              addedAt: new Date().toISOString(),
            },
          ];
        }
        // Persist to Firebase instantly
        if (selectedInvoiceId && newCartName.trim()) {
          const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
          const cartIndex = invoice?.carts.findIndex(
            (c) => c.name === newCartName.trim()
          );
          if (cartIndex !== undefined && cartIndex > -1 && invoice) {
            const updatedCarts = [...invoice.carts];
            updatedCarts[cartIndex] = {
              ...updatedCarts[cartIndex],
              items: newCartItems.map(sanitizeCartItem),
              total: 0, // Total calculation removed
            };
            onUpdateInvoice(selectedInvoiceId, { carts: updatedCarts });
          }
        }
        return newCartItems;
      });
      setShowProductKeypad(false);
      setProductForKeypad(null);
      setKeypadQuantity(1);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Active Invoices</h2>
        <button className="btn btn-primary" onClick={handleAddInvoice}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Invoice
        </button>
      </div>

      {showInvoiceForm && (
        <InvoiceForm
          clients={clients}
          onClose={() => setShowInvoiceForm(false)}
          onAddInvoice={onAddInvoice}
        />
      )}

      {showCartModal && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div
              className="modal-content"
              style={{
                backgroundColor: "#f8f9fa",
                border: "none",
                boxShadow: "0 0 20px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div
                className="modal-header"
                style={{
                  backgroundColor: "#e9ecef",
                  borderBottom: "1px solid #dee2e6",
                }}
              >
                <h5 className="modal-title">
                  {isCreatingCart
                    ? "Create New Cart"
                    : showNewCartForm
                    ? "Cart Options"
                    : "Cart Items"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowCartModal(false);
                    setSelectedInvoiceId(null);
                    setNewCartName("");
                    setShowNewCartForm(false);
                    setIsCreatingCart(false);
                    setCartItems([]);
                  }}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body" style={{ padding: "2rem" }}>
                {isCreatingCart ? (
                  <div>
                    <div className="mb-4">
                      <label htmlFor="newCartName" className="form-label">
                        Cart Name
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        id="newCartName"
                        value={newCartName}
                        onChange={(e) => setNewCartName(e.target.value)}
                        placeholder="Enter cart name"
                      />
                    </div>
                    <div className="d-flex justify-content-end gap-2">
                      <button
                        className="btn btn-secondary"
                        onClick={() => setIsCreatingCart(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveNewCart}
                        disabled={!newCartName.trim()}
                      >
                        Create Cart
                      </button>
                    </div>
                  </div>
                ) : showNewCartForm ? (
                  <div className="text-center">
                    <h5 className="mb-4" style={{ color: "#495057" }}>
                      Select a Cart
                    </h5>
                    <div className="d-flex flex-column gap-3">
                      {invoices.find((inv) => inv.id === selectedInvoiceId)
                        ?.carts?.length ? (
                        invoices
                          .find((inv) => inv.id === selectedInvoiceId)
                          ?.carts.map((cart) => (
                            <div
                              key={cart.id}
                              className="card p-3"
                              style={{
                                cursor: "pointer",
                                backgroundColor: "#fff",
                                border: "1px solid #dee2e6",
                              }}
                              onClick={() => handleSelectCart(cart.id)}
                            >
                              <div className="d-flex align-items-center">
                                <i
                                  className="bi bi-cart-check me-3"
                                  style={{
                                    fontSize: "1.5rem",
                                    color: "#0d6efd",
                                  }}
                                ></i>
                                <div className="flex-grow-1">
                                  <h6 className="mb-1">{cart.name}</h6>
                                  <small className="text-muted">
                                    {cart.items.length} items • Created{" "}
                                    {new Date(
                                      cart.createdAt
                                    ).toLocaleDateString()}
                                  </small>
                                </div>
                                <i className="bi bi-chevron-right"></i>
                              </div>
                            </div>
                          ))
                      ) : (
                        <p className="text-muted">No carts available</p>
                      )}
                      <button
                        className="btn btn-success w-100"
                        onClick={handleCreateNewCart}
                        style={{
                          padding: "0.75rem 1.5rem",
                          fontSize: "1.1rem",
                        }}
                      >
                        <i className="bi bi-plus-circle me-2"></i>
                        Create New Cart
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
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
                        placeholder="Enter cart name"
                        disabled
                      />
                    </div>

                    <div className="mb-3">
                      <div className="row row-cols-1 row-cols-md-3 g-3">
                        {(() => {
                          const invoice = invoices.find(
                            (inv) => inv.id === selectedInvoiceId
                          );
                          const client = clients.find(
                            (c) => c.id === invoice?.clientId
                          );
                          const clientProducts = products.filter((p) =>
                            client?.selectedProducts.includes(p.id)
                          );
                          return clientProducts.map((product) => (
                            <div className="col" key={product.id}>
                              <div
                                className="card h-100 text-center"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleProductCardClick(product)}
                              >
                                <img
                                  src={
                                    product.imageUrl ||
                                    "https://via.placeholder.com/100x100?text=Product"
                                  }
                                  alt={product.name}
                                  className="card-img-top mx-auto"
                                  style={{
                                    objectFit: "cover",
                                    height: "120px",
                                    width: "120px",
                                  }}
                                />
                                <div className="card-body p-2">
                                  <h6 className="card-title mb-1">
                                    {product.name}
                                  </h6>
                                  {/* Price removed */}
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {cartItems.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Quantity</th>
                              <th>Added By</th>
                              <th>Timestamp</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {cartItems.map((item, idx) => (
                              <tr key={item.productId + "-" + idx}>
                                <td>{item.productName}</td>
                                <td>{item.quantity ?? 0}</td>
                                <td>{item.addedBy || "-"}</td>
                                <td>
                                  {item.addedAt
                                    ? new Date(item.addedAt).toLocaleString()
                                    : ""}
                                </td>
                                <td>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() =>
                                      handleRemoveFromCart(item.productId)
                                    }
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            {/* Totals for each unique product */}
                            {(() => {
                              const totals: {
                                [productId: string]: {
                                  name: string;
                                  total: number;
                                };
                              } = {};
                              cartItems.forEach((item) => {
                                if (!totals[item.productId]) {
                                  totals[item.productId] = {
                                    name: item.productName,
                                    total: 0,
                                  };
                                }
                                totals[item.productId].total += item.quantity;
                              });
                              return Object.entries(totals).map(
                                ([productId, { name, total }]) => (
                                  <tr
                                    key={productId + "-total"}
                                    style={{ background: "#f8f9fa" }}
                                  >
                                    <td colSpan={1}>
                                      <strong>Total for {name}:</strong>
                                    </td>
                                    <td colSpan={2}>
                                      <strong>{total}</strong>
                                    </td>
                                    <td></td>
                                  </tr>
                                )
                              );
                            })()}
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted text-center">No items in cart</p>
                    )}

                    {/* Below the cart items table, show the total number of items in all carts for this invoice */}
                    {selectedInvoiceId &&
                      (() => {
                        const invoice = invoices.find(
                          (inv) => inv.id === selectedInvoiceId
                        );
                        if (!invoice) return null;
                        const totalItems = invoice.carts.reduce(
                          (sum, cart) =>
                            sum +
                            cart.items.reduce((s, i) => s + i.quantity, 0),
                          0
                        );
                        return (
                          <div className="mt-2 text-end">
                            <span className="badge bg-info">
                              Total items in all carts: {totalItems}
                            </span>
                          </div>
                        );
                      })()}

                    <div className="d-flex justify-content-end mt-3">
                      <button
                        className="btn btn-primary"
                        onClick={handleCartAssign}
                        disabled={!newCartName.trim() || cartItems.length === 0}
                      >
                        Save Cart
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {invoiceToDelete && (
        <DeleteConfirmationModal
          show={!!invoiceToDelete}
          onClose={() => setInvoiceToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Invoice"
          message={`Are you sure you want to delete the invoice for ${invoiceToDelete.clientName}?`}
        />
      )}

      {invoices.length > 0 ? (
        <div className="row row-cols-1 row-cols-md-3 g-3 mb-3">
          {invoices.map((invoice) => {
            const client = clients.find((c) => c.id === invoice.clientId);
            const isHovered = hoveredInvoiceId === invoice.id;
            const isDone = doneInvoices.includes(invoice.id);

            return (
              <div
                key={invoice.id}
                className={`card mb-3${isDone ? " bg-light text-muted" : ""}`}
                onClick={() => handleInvoiceClick(invoice.id)}
                style={{ cursor: "pointer", position: "relative" }}
                onMouseEnter={() => setHoveredInvoiceId(invoice.id)}
                onMouseLeave={() => setHoveredInvoiceId(null)}
              >
                <div className="card-body d-flex align-items-center">
                  {/* Removed cart icon */}
                  <div className="flex-grow-1">
                    <h5 className="card-title mb-1">{invoice.clientName}</h5>
                    <small className="text-muted">
                      {new Date(invoice.date).toLocaleDateString()}
                    </small>
                    {invoice.carts && invoice.carts.length > 0 && (
                      <div className="mt-2">
                        <strong style={{ color: "#004AAD", fontSize: 13 }}>
                          Carts:
                        </strong>
                        <ul
                          className="mb-0 ps-3"
                          style={{ fontSize: 13, color: "#333" }}
                        >
                          {invoice.carts.map((cart) => (
                            <li key={cart.id}>
                              <span style={{ fontWeight: 600 }}>
                                {cart.name}
                              </span>
                              {cart.items && cart.items.length > 0 && (
                                <span style={{ color: "#888", marginLeft: 6 }}>
                                  ({cart.items.length} item
                                  {cart.items.length !== 1 ? "s" : ""})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* Checkmark and Trashcan actions */}
                  <button
                    className={`btn btn-sm btn-outline-success me-2${
                      isDone ? " active" : ""
                    }`}
                    title={isDone ? "Mark as not done" : "Mark as done"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDoneInvoices((prev) =>
                        prev.includes(invoice.id)
                          ? prev.filter((id) => id !== invoice.id)
                          : [...prev, invoice.id]
                      );
                    }}
                  >
                    <i className="bi bi-check-lg"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    title="Delete invoice"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(invoice);
                    }}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-5">
          <i className="bi bi-receipt display-1 text-muted mb-3"></i>
          <h4 className="text-muted">No Active Invoices</h4>
          <p className="text-muted">
            Click the "+" button to create your first invoice
          </p>
        </div>
      )}

      {/* Product Keypad Modal */}
      {showProductKeypad && productForKeypad && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add {productForKeypad.name}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowProductKeypad(false)}
                ></button>
              </div>
              <div className="modal-body text-center">
                <img
                  src={
                    productForKeypad.imageUrl ||
                    "https://via.placeholder.com/100x100?text=Product"
                  }
                  alt={productForKeypad.name}
                  style={{
                    width: 100,
                    height: 100,
                    objectFit: "cover",
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                />
                <div style={{ fontSize: 24, marginBottom: 16 }}>
                  Quantity: {keypadQuantity}
                </div>
                <div
                  className="d-flex flex-wrap justify-content-center mb-3"
                  style={{ maxWidth: 240, margin: "0 auto" }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                    <button
                      key={num}
                      className="btn btn-outline-primary m-1"
                      style={{ width: 60, height: 60, fontSize: 24 }}
                      onClick={() =>
                        setKeypadQuantity((q) => (q === 0 ? num : q * 10 + num))
                      }
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    className="btn btn-outline-secondary m-1"
                    style={{ width: 60, height: 60, fontSize: 24 }}
                    onClick={() => setKeypadQuantity(1)}
                  >
                    C
                  </button>
                  <button
                    className="btn btn-outline-secondary m-1"
                    style={{ width: 60, height: 60, fontSize: 24 }}
                    onClick={() =>
                      setKeypadQuantity((q) => (q > 9 ? Math.floor(q / 10) : 1))
                    }
                  >
                    ←
                  </button>
                </div>
                <button
                  className="btn btn-success w-100"
                  style={{ fontSize: 20 }}
                  onClick={handleKeypadAdd}
                >
                  Add {keypadQuantity} to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
