import React, { useEffect, useState, useMemo } from "react";
import { Client, Product, Invoice, CartItem, Cart, LaundryCart } from "../types";
import InvoiceForm from "./InvoiceForm";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import LaundryCartModal from "./LaundryCartModal";
import {
  getAllPickupGroups,
  updatePickupGroupStatus,
} from "../services/firebaseService";

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
  selectedInvoiceId?: string | null;
  setSelectedInvoiceId?: (id: string | null) => void;
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

// Helper: determine initial carts for a new group (customize as needed)
function getInitialCartsForGroup(groupData: any) {
  // Example: always start with 1 cart. Replace with your grouping logic.
  return [
    {
      id: Date.now().toString(),
      name: "Cart 1",
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
    },
  ];
}

// Helper to convert Cart to LaundryCart for modal compatibility
function cartToLaundryCart(cart: Cart): LaundryCart {
  return {
    id: cart.id,
    name: cart.name,
    isActive: true, // Assume active for selection
  };
}

export default function ActiveInvoices({
  clients,
  products,
  invoices,
  onAddInvoice,
  onDeleteInvoice,
  onUpdateInvoice,
  selectedInvoiceId: selectedInvoiceIdProp,
  setSelectedInvoiceId: setSelectedInvoiceIdProp,
}: ActiveInvoicesProps) {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedInvoiceIdLocal, setSelectedInvoiceIdLocal] = useState<
    string | null
  >(null);
  const selectedInvoiceId =
    selectedInvoiceIdProp !== undefined
      ? selectedInvoiceIdProp
      : selectedInvoiceIdLocal;
  const setSelectedInvoiceId =
    setSelectedInvoiceIdProp || setSelectedInvoiceIdLocal;
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

  // --- GROUP OVERVIEW ---
  const [pickupGroups, setPickupGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [logGroup, setLogGroup] = useState<any | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductGroup, setAddProductGroup] = useState<any | null>(null);
  const [selectedCartId, setSelectedCartId] = useState<string>("");
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>("");
  const [addProductQty, setAddProductQty] = useState<number>(1);

  // New state variables for Add To Group modal
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [addToGroupClientId, setAddToGroupClientId] = useState("");
  const [addToGroupProductId, setAddToGroupProductId] = useState("");
  const [addToGroupMode, setAddToGroupMode] = useState<
    "carts" | "quantity" | "pounds"
  >("carts");
  const [addToGroupValue, setAddToGroupValue] = useState<number>(1);
  const [addToGroupError, setAddToGroupError] = useState("");
  const [addToGroupLoading, setAddToGroupLoading] = useState(false);

  // --- Cart Selection Modal State ---
  const [showCartSelectModal, setShowCartSelectModal] = useState(false);
  const [cartSelectInvoiceId, setCartSelectInvoiceId] = useState<string | null>(null);
  const [cartSelectCarts, setCartSelectCarts] = useState<Cart[]>([]);

  // Placeholder for current user. Replace with actual user logic as needed.
  const currentUser = "Current User";

  useEffect(() => {
    (async () => {
      setGroupsLoading(true);
      const groups = await getAllPickupGroups();
      setPickupGroups(groups);
      setGroupsLoading(false);
    })();
  }, []);

  const handleAddInvoice = () => {
    setShowInvoiceForm(true);
  };

  // --- Cart Selection Handler ---
  const handleInvoiceClick = (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      setCartSelectInvoiceId(invoiceId);
      setCartSelectCarts(invoice.carts || []);
      setShowCartSelectModal(true);
    }
  };

  // --- Cart Selection Modal Logic ---
  const handleCartSelect = async (cart: Cart) => {
    setSelectedInvoiceId(cartSelectInvoiceId);
    setNewCartName(cart.name);
    setCartItems(cart.items);
    setShowCartSelectModal(false);
    setShowCartModal(true);
    setIsCreatingCart(false);
  };

  const handleCartCreate = async (cartName: string) => {
    if (!cartSelectInvoiceId) return null;
    const invoice = invoices.find((inv) => inv.id === cartSelectInvoiceId);
    if (!invoice) return null;
    const newCart: Cart = {
      id: Date.now().toString(),
      name: cartName,
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
    };
    await onUpdateInvoice(cartSelectInvoiceId, {
      carts: [...(invoice.carts || []), newCart],
    });
    setCartSelectCarts([...(invoice.carts || []), newCart]);
    // Immediately select the new cart
    await handleCartSelect(newCart);
    return newCart;
  };

  // --- Delete Confirmation Logic ---
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

  const handleStatusChange = async (groupId: string, newStatus: string) => {
    // Normalize status for Segregation/Segregacion
    let normalizedStatus = newStatus;
    if (
      newStatus.toLowerCase() === "segregacion" ||
      newStatus.toLowerCase() === "segregation"
    ) {
      normalizedStatus = "Segregation";
    }

    // Find the group and client
    const group = pickupGroups.find((g) => g.id === groupId);
    const client = group
      ? clients.find((c) => c.id === group.clientId)
      : undefined;

    // If changing from 'Recibido' and the new status is 'Segregation', check client settings
    if (
      group &&
      group.status === "Recibido" &&
      normalizedStatus === "Segregation" &&
      client
    ) {
      if (!client.segregation) {
        // If client does not need segregation, go directly to Tunnel or Conventional
        normalizedStatus =
          client.washingType === "Conventional" ? "Conventional" : "Tunnel";
      }
    }

    setPickupGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, status: normalizedStatus } : g
      )
    );
    setStatusUpdating(groupId);
    await updatePickupGroupStatus(groupId, normalizedStatus);

    // If status is Segregation, ensure client.segregation is true
    if (normalizedStatus === "Segregation") {
      if (group && client && !client.segregation) {
        await import("../firebase").then(({ db }) =>
          import("firebase/firestore").then(({ doc, updateDoc }) =>
            updateDoc(doc(db, "clients", client.id), { segregation: true })
          )
        );
      }
    }

    // Refetch groups to ensure UI is in sync with backend
    const groups = await getAllPickupGroups();
    setPickupGroups(groups);
    setStatusUpdating(null);
    setEditingGroupId(null);
  };

  // Progress bar steps
  const STATUS_STEPS = [
    { key: "Segregation", label: "Segregando" },
    { key: "Tunnel", label: "Tunnel/Conventional" },
    { key: "Empaque", label: "Empaque" },
    { key: "Entregado", label: "Lista para Entrega" },
  ];

  function getStepIndex(status: string) {
    const idx = STATUS_STEPS.findIndex(
      (s) =>
        status === s.key ||
        (s.key === "Tunnel" &&
          (status === "Tunnel" || status === "Conventional"))
    );
    return idx === -1 ? 0 : idx;
  }

  const handleOpenAddProductModal = (group: any) => {
    setAddProductGroup(group);
    setShowAddProductModal(true);
    setSelectedCartId("");
    setSelectedAddProductId("");
    setAddProductQty(1);
    setAddProductMode("cart");
  };

  const [addProductMode, setAddProductMode] = useState<
    "cart" | "quantity" | "pounds"
  >("cart");

  // --- Delete Entry from Invoice Cart ---
  const handleDeleteCartItem = async (cartId: string, productId: string) => {
    if (!selectedInvoiceId) return;
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;
    const updatedCarts = invoice.carts.map((cart) => {
      if (cart.id !== cartId) return cart;
      return {
        ...cart,
        items: cart.items.filter((item) => item.productId !== productId),
      };
    });
    await onUpdateInvoice(selectedInvoiceId, { carts: updatedCarts });
  };

  // Archive logic: show all groups except those with status 'Entregado' (Boleta Impresa) whose endTime/startTime is before today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Restore: include Tunnel groups in main overview
  const visiblePickupGroups = pickupGroups.filter((g) => {
    if (g.status === "deleted") return false;
    if (g.status === "Entregado" || g.status === "Boleta Impresa") {
      // Use endTime if available, else startTime
      const groupDate = g.endTime || g.startTime;
      if (!groupDate) return false;
      const groupDay = new Date(groupDate);
      groupDay.setHours(0, 0, 0, 0);
      // If group was completed before today, archive it
      if (groupDay < today) return false;
    }
    return true;
  });

  // --- Sectioned groupings ---
  // const tunnelGroups = visiblePickupGroups.filter((g) => g.status === "Tunnel");
  // const conventionalGroups = visiblePickupGroups.filter(
  //   (g) => g.status === "Conventional"
  // );
  // const pendingProductGroups = visiblePickupGroups.filter(
  //   (g) => g.pendingProduct === true
  // );

  return (
    <div className="container-fluid py-4">
      {/* --- GROUP OVERVIEW --- */}
      <div className="mb-4 mt-4">
        {/* Added mt-4 for top margin */}
        <h2 className="mb-3">Today's Client Groups Overview</h2>
        {groupsLoading ? (
          <div>Loading groups...</div>
        ) : visiblePickupGroups.length === 0 ? (
          <div className="text-muted">No groups for today.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>Client</th>
                  <th>Date Created</th>
                  <th>Total Pounds</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visiblePickupGroups.map((group, groupIdx) => {
                  const stepIdx = getStepIndex(group.status);
                  const totalSteps = STATUS_STEPS.length;
                  const percent = (stepIdx + 1) / totalSteps;
                  const interpolateColor = (
                    a: string,
                    b: string,
                    t: number
                  ) => {
                    const ah = a.match(/\w\w/g)!.map((x) => parseInt(x, 16));
                    const bh = b.match(/\w\w/g)!.map((x) => parseInt(x, 16));
                    const rh = ah.map((av, i) =>
                      Math.round(av + (bh[i] - av) * t)
                    );
                    return `rgb(${rh[0]},${rh[1]},${rh[2]})`;
                  };
                  const barColor = interpolateColor(
                    "#ffe066",
                    "#51cf66",
                    percent
                  );
                  // Format date: Hour:Minute AM/PM, Month/Date
                  const createdDate = group.startTime
                    ? (() => {
                        const d = new Date(group.startTime);
                        const pad = (n: number) =>
                          n.toString().padStart(2, "0");
                        let hours = d.getHours();
                        const minutes = pad(d.getMinutes());
                        const ampm = hours >= 12 ? "PM" : "AM";
                        hours = hours % 12;
                        if (hours === 0) hours = 12;
                        return `${hours}:${minutes} ${ampm}  ${d.toLocaleString(
                          "en-US",
                          { month: "short" }
                        )} ${d.getDate()}`;
                      })()
                    : "-";
                  return (
                    <tr
                      key={group.id || groupIdx}
                      style={
                        group.showInTunnel ? { background: "#fff3cd" } : {}
                      }
                    >
                      <td>
                        <span style={{ fontSize: 20, fontWeight: 700 }}>
                          {group.clientName}
                        </span>
                      </td>
                      <td>{createdDate}</td>
                      <td>
                        {typeof group.totalWeight === "number"
                          ? group.totalWeight.toFixed(2)
                          : "?"}
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={group.status}
                          disabled={statusUpdating === group.id}
                          onChange={(e) =>
                            handleStatusChange(group.id, e.target.value)
                          }
                          style={{ minWidth: 120 }}
                        >
                          <option value="Recibido">Recibido</option>
                          <option value="Segregation">Segregacion</option>
                          <option value="Tunnel">Tunnel</option>
                          <option value="Conventional">Conventional</option>
                          <option value="Empaque">Empaque</option>
                          <option value="Entregado">Boleta Impresa</option>
                          <option value="deleted">Deleted</option>
                        </select>
                        {/* Progress Bar */}
                        <div style={{ marginTop: 8 }}>
                          <div
                            style={{
                              height: 16,
                              background: "#eee",
                              borderRadius: 8,
                              overflow: "hidden",
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                width: `${((stepIdx + 1) / totalSteps) * 100}%`,
                                background: barColor,
                                height: "100%",
                                transition: "width 0.3s, background 0.3s",
                              }}
                            ></div>
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: 10,
                                color: "#555",
                                padding: "0 4px",
                                pointerEvents: "none",
                              }}
                            >
                              {STATUS_STEPS.map((step, i) => (
                                <span
                                  key={step.key}
                                  style={{
                                    fontWeight: i === stepIdx ? 700 : 400,
                                  }}
                                >
                                  {i + 1}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              marginTop: 2,
                              textAlign: "center",
                            }}
                          >
                            {STATUS_STEPS[stepIdx]?.label}
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-info btn-sm me-2"
                          onClick={() => {
                            setLogGroup(group);
                            setShowLogModal(true);
                          }}
                        >
                          View Log
                        </button>
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          onClick={() => {
                            setEditGroupId(group.id);
                            setEditGroupName(group.clientName);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => setDeletingGroupId(group.id)}
                        >
                          Delete
                        </button>
                        {group.status === "Conventional" && (
                          <button
                            className="btn btn-success btn-sm ms-2"
                            title="Add Product to Cart"
                            onClick={() => handleOpenAddProductModal(group)}
                          >
                            +
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="row">
        <div className="col-md-6">
          <h3 className="mb-4">Active Invoices</h3>
        </div>
        <div className="col-md-6 text-md-end">
          <button className="btn btn-primary" onClick={handleAddInvoice}>
            Create New Invoice
          </button>
        </div>
      </div>

      <div className="row">
        {invoices.length === 0 ? (
          <div className="text-center text-muted py-5">
            No active invoices found. Create a new invoice to get started.
          </div>
        ) : (
          invoices
            .slice() // copy to avoid mutating original
            .sort((a, b) => {
              // Sort by date or id for consistent numbering (oldest first)
              // If invoiceNumber exists, use it; else fallback to date or id
              if (a.invoiceNumber && b.invoiceNumber) {
                return a.invoiceNumber - b.invoiceNumber;
              }
              if (a.date && b.date) {
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              }
              return a.id.localeCompare(b.id);
            })
            .map((invoice, idx) => (
              <div
                key={invoice.id}
                className="col-lg-4 col-md-6 mb-4"
                onMouseEnter={() => setHoveredInvoiceId(invoice.id)}
                onMouseLeave={() => setHoveredInvoiceId(null)}
              >
                <div className="card h-100">
                  <div className="card-body">
                    <h5 className="card-title">
                      Invoice #{invoice.invoiceNumber ? String(invoice.invoiceNumber).padStart(4, "0") : String(idx + 1).padStart(4, "0")}
                      {" - "}
                      {clients.find((c) => c.id === invoice.clientId)?.name || invoice.clientName}
                      {" - "}
                      {(() => {
                        // Prefer invoice.date, fallback to createdAt of first cart, else blank
                        let dateStr = invoice.date;
                        if (!dateStr && invoice.carts && invoice.carts.length > 0) {
                          dateStr = invoice.carts[0].createdAt;
                        }
                        if (dateStr) {
                          const d = new Date(dateStr);
                          return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
                        }
                        return "";
                      })()}
                    </h5>
                    <p className="card-text">
                      <strong>Carts:</strong>{" "}
                      {invoice.carts && invoice.carts.length > 0 ? (
                        invoice.carts.map((cart, cartIdx) => (
                          <span key={cart.id || cartIdx}>
                            {cart.name}
                            {cartIdx < invoice.carts.length - 1 ? ", " : ""}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted">No carts</span>
                      )}
                    </p>
                    <p className="card-text">
                      Products: {invoice.carts
                        .flatMap((cart) => cart.items)
                        .map((item) => `${item.productName} (x${item.quantity})`)
                        .join(", ")}
                    </p>
                    {/* Removed price/total display */}
                  </div>
                  <div className="card-footer bg-transparent border-top-0">
                    <div className="d-flex justify-content-between">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => handleInvoiceClick(invoice.id)}
                      >
                        View / Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteClick(invoice)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Invoice Form */}
      {showInvoiceForm && (
        <InvoiceForm
          clients={clients}
          products={products}
          onAddInvoice={onAddInvoice}
          onClose={() => setShowInvoiceForm(false)}
        />
      )}

      {/* Cart Modal */}
      {showCartModal && selectedInvoiceId && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Invoice Cart</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCartModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Show total weight if present on invoice */}
                {(() => {
                  const invoice = invoices.find(
                    (inv) => inv.id === selectedInvoiceId
                  );
                  if (invoice && typeof invoice.totalWeight === "number") {
                    return (
                      <div className="alert alert-info mb-3">
                        <strong>Total Weight:</strong>{" "}
                        {invoice.totalWeight.toFixed(2)} lbs
                      </div>
                    );
                  }
                  return null;
                })()}
                {(() => {
                  const invoice = invoices.find(
                    (inv) => inv.id === selectedInvoiceId
                  );
                  if (!invoice) return null;
                  return (
                    <>
                      {invoice.carts.map((cart, cartIdx) => (
                        <div
                          key={cart.id || cartIdx}
                          className="mb-3 border rounded p-2"
                        >
                          <div className="fw-bold mb-2">{cart.name}</div>
                          {cart.items.length === 0 ? (
                            <div className="text-muted">
                              No products in cart.
                            </div>
                          ) : (
                            cart.items.map((item, itemIdx) => (
                              <div
                                key={item.productId || itemIdx}
                                className="d-flex justify-content-between align-items-center py-2"
                              >
                                <div>
                                  {item.productName} (x{item.quantity})
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <div>
                                    ${(item.price * item.quantity).toFixed(2)}
                                  </div>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    title="Delete entry"
                                    onClick={() =>
                                      handleDeleteCartItem(
                                        cart.id,
                                        item.productId
                                      )
                                    }
                                  >
                                    <span aria-hidden="true">🗑️</span>
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}
                <div className="mb-3">
                  <label className="form-label">Select Product</label>
                  <select
                    className="form-select"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                  >
                    <option value="">-- Select a product --</option>
                    {products.map((product, idx) => (
                      <option key={product.id || idx} value={product.id}>
                        {product.name} - ${product.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="mt-4">
                  <h6>Or add products using the keypad:</h6>
                  <div className="row">
                    {products.map((product, prodIdx) => (
                      <div
                        key={product.id || prodIdx}
                        className="col-6 col-md-4 mb-3"
                        onClick={() => handleProductCardClick(product)}
                      >
                        <div className="card text-center">
                          <div className="card-body">
                            <h5 className="card-title">{product.name}</h5>
                            <p className="card-text">
                              ${product.price.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCartModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <DeleteConfirmationModal
          invoice={invoiceToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setInvoiceToDelete(null)}
        />
      )}

      {/* Product Keypad Modal */}
      {showProductKeypad && productForKeypad && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Add {productForKeypad.name} to Cart
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowProductKeypad(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={keypadQuantity}
                    onChange={(e) => setKeypadQuantity(Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowProductKeypad(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleKeypadAdd}>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {showLogModal && logGroup && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Status Change Log</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowLogModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {Array.isArray(logGroup.statusLog) &&
                logGroup.statusLog.length > 0 ? (
                  <ul className="list-group">
                    {logGroup.statusLog.map((log: any, idx: number) => (
                      <li key={idx} className="list-group-item">
                        <b>Step:</b> {log.step} <br />
                        <b>Time:</b>{" "}
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString()
                          : "-"}{" "}
                        <br />
                        <b>User:</b> {log.user || "-"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted">
                    No log available for this group.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowLogModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product to Cart Modal */}
      {showAddProductModal && addProductGroup && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Product to Group</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddProductModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Select Client</label>
                  <select
                    className="form-select"
                    value={addProductGroup.clientId || ""}
                    disabled
                  >
                    {clients.map((client, clientIdx) => (
                      <option key={client.id || clientIdx} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Select Product</label>
                  <select
                    className="form-select"
                    value={selectedAddProductId}
                    onChange={(e) => setSelectedAddProductId(e.target.value)}
                  >
                    <option value="">-- Select a product --</option>
                    {products.map((product, prodIdx) => (
                      <option key={product.id || prodIdx} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Add By</label>
                  <div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByCart"
                        value="cart"
                        checked={addProductMode === "cart"}
                        onChange={() => setAddProductMode("cart")}
                      />
                      <label className="form-check-label" htmlFor="addByCart">
                        Carts
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByQty"
                        value="quantity"
                        checked={addProductMode === "quantity"}
                        onChange={() => setAddProductMode("quantity")}
                      />
                      <label className="form-check-label" htmlFor="addByQty">
                        Quantity
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByLbs"
                        value="pounds"
                        checked={addProductMode === "pounds"}
                        onChange={() => setAddProductMode("pounds")}
                      />
                      <label className="form-check-label" htmlFor="addByLbs">
                        Pounds
                      </label>
                    </div>
                  </div>
                </div>
                {addProductMode === "cart" && (
                  <div className="mb-3">
                    <label className="form-label">Select Cart</label>
                    <select
                      className="form-select"
                      value={selectedCartId}
                      onChange={(e) => setSelectedCartId(e.target.value)}
                    >
                      <option value="">-- Select a cart --</option>
                      {(addProductGroup.carts || []).map(
                        (cart: any, idx: number) => (
                          <option key={cart.id || idx} value={cart.id}>
                            {cart.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}
                {(addProductMode === "quantity" ||
                  addProductMode === "pounds") && (
                  <div className="mb-3">
                    <label className="form-label">
                      {addProductMode === "quantity" ? "Quantity" : "Pounds"}
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      value={addProductQty}
                      onChange={(e) => setAddProductQty(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddProductModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={
                    !selectedAddProductId ||
                    (addProductMode === "cart" && !selectedCartId) ||
                    ((addProductMode === "quantity" ||
                      addProductMode === "pounds") &&
                      addProductQty < 1)
                  }
                  onClick={async () => {
                    const product = products.find(
                      (p) => p.id === selectedAddProductId
                    );
                    if (!product) return;
                    // Find or create 'Pending Products' group for this client
                    let pendingGroup = pickupGroups.find(
                      (g) =>
                        g.clientId === addProductGroup.clientId &&
                        g.status === "Pending Products"
                    );
                    if (!pendingGroup) {
                      // Create new group in Firestore
                      const now = new Date();
                      const initialCarts = getInitialCartsForGroup({
                        clientId: addProductGroup.clientId,
                        clientName: addProductGroup.clientName,
                      });
                      const groupData = {
                        clientId: addProductGroup.clientId,
                        clientName: addProductGroup.clientName,
                        startTime: now,
                        endTime: now,
                        totalWeight: 0,
                        status: "Pending Products",
                        carts: initialCarts,
                        numCarts: initialCarts.length, // Add number of carts as a value
                        segregatedCarts: null, // Set segregatedCarts to null
                        createdAt: now.toISOString(),
                        // washingType: 'Conventional', // Ensure this is set for filtering
                      };
                      const groupRef = await import("../firebase").then(
                        ({ db }) =>
                          import("firebase/firestore").then(
                            ({ collection, addDoc }) =>
                              addDoc(collection(db, "pickup_groups"), groupData)
                          )
                      );
                      pendingGroup = { ...groupData, id: groupRef.id };
                      setPickupGroups((prev) => [...prev, pendingGroup]);
                    } else {
                      // If group exists but status is not 'Pending Products', update it
                      if (pendingGroup.status !== "Pending Products") {
                        await import("../firebase").then(({ db }) =>
                          import("firebase/firestore").then(
                            ({ doc, updateDoc }) =>
                              updateDoc(doc(db, "pickup_groups", pendingGroup.id), {
                                status: "Pending Products",
                              })
                          )
                        );
                        pendingGroup.status = "Pending Products";
                      }
                    }
                    // Add product to the group's carts
                    let updatedCarts = Array.isArray(pendingGroup.carts)
                      ? [...pendingGroup.carts]
                      : [];
                    if (addProductMode === "cart") {
                      let cartIdx = updatedCarts.findIndex(
                        (c: any) => c.id === selectedCartId
                      );
                      if (cartIdx === -1) {
                        const newCart = {
                          id: Date.now().toString(),
                          name: `Cart ${updatedCarts.length + 1}`,
                          items: [],
                          total: 0,
                          createdAt: new Date().toISOString(),
                        };
                        updatedCarts.push(newCart);
                        cartIdx = updatedCarts.length - 1;
                      }
                      const cart = { ...updatedCarts[cartIdx] };
                      const existingItemIdx = cart.items.findIndex(
                        (item: any) => item.productId === product.id
                      );
                      if (existingItemIdx > -1) {
                        cart.items[existingItemIdx].quantity += addProductQty;
                      } else {
                        cart.items.push({
                          productId: product.id,
                          productName: product.name,
                          quantity: addProductQty,
                          price: product.price,
                          addedBy: currentUser,
                          addedAt: new Date().toISOString(),
                        });
                      }
                      updatedCarts[cartIdx] = cart;
                    } else {
                      const newCart = {
                        id: Date.now().toString(),
                        name: `${
                          addProductMode === "quantity" ? "Qty" : "Lbs"
                        } Cart - ${new Date().toLocaleTimeString()}`,
                        items: [
                          {
                            productId: product.id,
                            productName: product.name,
                            quantity: addProductQty,
                            price: product.price,
                            addedBy: currentUser,
                            addedAt: new Date().toISOString(),
                          },
                        ],
                        total: 0,
                        createdAt: new Date().toISOString(),
                      };
                      updatedCarts.push(newCart);
                    }
                    // Update in Firestore
                    // Removed Pending Products logic and group update since Pending Products section is removed
                    setShowAddProductModal(false);
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add To Group Modal */}
      {showAddToGroupModal && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Product to Group</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddToGroupModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Client</label>
                  <select
                    className="form-select"
                    value={addToGroupClientId}
                    onChange={(e) => setAddToGroupClientId(e.target.value)}
                  >
                    <option value="">-- Select a client --</option>
                    {clients.map((client, clientIdx) => (
                      <option key={client.id || clientIdx} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Product</label>
                  <select
                    className="form-select"
                    value={addToGroupProductId}
                    onChange={(e) => setAddToGroupProductId(e.target.value)}
                  >
                    <option value="">-- Select a product --</option>
                    {products.map((product, prodIdx) => (
                      <option key={product.id || prodIdx} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Mode</label>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="mode-carts"
                      name="addToGroupMode"
                      value="carts"
                      checked={addToGroupMode === "carts"}
                      onChange={() => setAddToGroupMode("carts")}
                    />
                    <label className="form-check-label" htmlFor="mode-carts">
                      Carts
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="mode-quantity"
                      name="addToGroupMode"
                      value="quantity"
                      checked={addToGroupMode === "quantity"}
                      onChange={() => setAddToGroupMode("quantity")}
                    />
                    <label className="form-check-label" htmlFor="mode-quantity">
                      Quantity
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="mode-pounds"
                      name="addToGroupMode"
                      value="pounds"
                      checked={addToGroupMode === "pounds"}
                      onChange={() => setAddToGroupMode("pounds")}
                    />
                    <label className="form-check-label" htmlFor="mode-pounds">
                      Pounds
                    </label>
                  </div>
                </div>
                {(addToGroupMode === "quantity" ||
                  addToGroupMode === "pounds") && (
                  <div className="mb-3">
                    <label className="form-label">
                      {addToGroupMode === "quantity" ? "Quantity" : "Pounds"}
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      value={addToGroupValue}
                      onChange={(e) =>
                        setAddToGroupValue(Number(e.target.value))
                      }
                    />
                  </div>
                )}
                {addToGroupError && (
                  <div className="alert alert-danger">{addToGroupError}</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddToGroupModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={addToGroupLoading}
                  onClick={async () => {
                    setAddToGroupError("");
                    setAddToGroupLoading(true);
                    try {
                      if (
                        !addToGroupClientId ||
                        !addToGroupProductId ||
                        (addToGroupMode !== "carts" && addToGroupValue < 1)
                      ) {
                        setAddToGroupError(
                          "Please select all fields and enter a valid value."
                        );
                        setAddToGroupLoading(false);
                        return;
                      }
                      // Find the group for this client (Conventional or Tunnel)
                      const group = pickupGroups.find(
                        (g) =>
                          g.clientId === addToGroupClientId &&
                          (g.status === "Conventional" || g.status === "Tunnel")
                      );
                      if (!group) {
                        setAddToGroupError("No group found for this client today.");
                        setAddToGroupLoading(false);
                        return;
                      }
                      // Find or create cart
                      let carts = Array.isArray(group.carts) ? [...group.carts] : [];
                      let cartId = carts.length > 0 ? carts[0].id : Date.now().toString();
                      let cartIdx = carts.findIndex((c) => c.id === cartId);
                      if (cartIdx === -1) {
                        carts.push({
                          id: cartId,
                          name: `Cart ${carts.length + 1}`,
                          items: [],
                          total: 0,
                          createdAt: new Date().toISOString(),
                        });
                        cartIdx = carts.length - 1;
                      }
                      const product = products.find((p) => p.id === addToGroupProductId);
                      if (!product) throw new Error("Product not found");
                      let cart = { ...carts[cartIdx] };
                      // Add product with the selected mode
                      let item: any = {
                        productId: product.id,
                        productName: product.name,
                        price: product.price,
                        addedBy: currentUser,
                        addedAt: new Date().toISOString(),
                      };
                      if (addToGroupMode === "carts") {
                        item.quantity = 1;
                      } else if (addToGroupMode === "quantity") {
                        item.quantity = addToGroupValue;
                      } else if (addToGroupMode === "pounds") {
                        item.quantity = addToGroupValue;
                      }
                      // If product already exists, update quantity
                      const existingIdx = cart.items.findIndex((i: any) => i.productId === product.id);
                      if (existingIdx > -1) {
                        cart.items[existingIdx].quantity += item.quantity;
                      } else {
                        cart.items.push(item);
                      }
                      carts[cartIdx] = cart;
                      // Update in Firestore
                      // Removed Pending Products logic and group update since Pending Products section is removed
                      setShowAddToGroupModal(false);
                    } catch (err: any) {
                      setAddToGroupError(
                        err.message || "Error adding product to group"
                      );
                    } finally {
                      setAddToGroupLoading(false);
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Selection Modal */}
      {showCartSelectModal && (
        <LaundryCartModal
          show={showCartSelectModal}
          onClose={() => setShowCartSelectModal(false)}
          onSelect={async (laundryCart) => {
            // Find the full Cart object by id
            const cart = cartSelectCarts.find((c) => c.id === laundryCart.id);
            if (cart) await handleCartSelect(cart);
          }}
          carts={cartSelectCarts.map(cartToLaundryCart)}
          onAddCart={async (cartName) => {
            const newCart = await handleCartCreate(cartName);
            return newCart ? cartToLaundryCart(newCart) : { id: '', name: '', isActive: true };
          }}
        />
      )}
    </div>
  );
}
