import React, { useEffect, useState, useMemo } from "react";
import { Client, Product, Invoice, CartItem, Cart } from "../types";
import InvoiceForm from "./InvoiceForm";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import {
  getTodayPickupGroups,
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
  const [addToGroupMode, setAddToGroupMode] = useState<"carts"|"quantity"|"pounds">("carts");
  const [addToGroupValue, setAddToGroupValue] = useState<number>(1);
  const [addToGroupError, setAddToGroupError] = useState("");
  const [addToGroupLoading, setAddToGroupLoading] = useState(false);

  // Placeholder for current user. Replace with actual user logic as needed.
  const currentUser = "Current User";

  useEffect(() => {
    (async () => {
      setGroupsLoading(true);
      const groups = await getTodayPickupGroups();
      setPickupGroups(groups);
      setGroupsLoading(false);
    })();
  }, []);

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

  const handleStatusChange = async (groupId: string, newStatus: string) => {
    // Normalize status for Segregation/Segregacion
    let normalizedStatus = newStatus;
    if (newStatus.toLowerCase() === "segregacion" || newStatus.toLowerCase() === "segregation") {
      normalizedStatus = "Segregation";
    }

    // Find the group and client
    const group = pickupGroups.find(g => g.id === groupId);
    const client = group ? clients.find(c => c.id === group.clientId) : undefined;

    // If changing from 'Recibido' and the new status is 'Segregation', check client settings
    if (group && group.status === "Recibido" && normalizedStatus === "Segregation" && client) {
      if (!client.segregation) {
        // If client does not need segregation, go directly to Tunnel or Conventional
        normalizedStatus = client.washingType === "Conventional" ? "Conventional" : "Tunnel";
      }
    }

    setPickupGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, status: normalizedStatus } : g))
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
    const groups = await getTodayPickupGroups();
    setPickupGroups(groups);
    setStatusUpdating(null);
    setEditingGroupId(null);
  };

  // Progress bar steps
  const STATUS_STEPS = [
    { key: "Segregation", label: "Segregando" },
    { key: "Tunnel", label: "Tunnel/Conventional" },
    { key: "procesandose", label: "Procesandose" },
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

  const [addProductMode, setAddProductMode] = useState<"cart" | "quantity" | "pounds">("cart");

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

  // Filter out groups with status 'deleted' from pickupGroups before rendering
  const visiblePickupGroups = pickupGroups.filter(g => g.status !== 'deleted');

  return (
    <div className="container-fluid py-4">
      {/* --- GROUP OVERVIEW --- */}
      <div className="mb-4">
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
                {visiblePickupGroups.map((group) => {
                  const stepIdx = getStepIndex(group.status);
                  const totalSteps = STATUS_STEPS.length;
                  const percent = (stepIdx + 1) / totalSteps;
                  const interpolateColor = (a: string, b: string, t: number) => {
                    const ah = a.match(/\w\w/g)!.map((x) => parseInt(x, 16));
                    const bh = b.match(/\w\w/g)!.map((x) => parseInt(x, 16));
                    const rh = ah.map((av, i) => Math.round(av + (bh[i] - av) * t));
                    return `rgb(${rh[0]},${rh[1]},${rh[2]})`;
                  };
                  const barColor = interpolateColor("#ffe066", "#51cf66", percent);
                  // Format date
                  const createdDate = group.createdAt
                    ? new Date(group.createdAt).toLocaleString()
                    : "-";
                  return (
                    <tr key={group.id}
                      style={group.showInTunnel ? { background: "#fff3cd" } : {}}
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
                          onChange={(e) => handleStatusChange(group.id, e.target.value)}
                          style={{ minWidth: 120 }}
                        >
                          <option value="Recibido">Recibido</option>
                          <option value="Segregation">Segregacion</option>
                          <option value="Tunnel">Tunnel</option>
                          <option value="Conventional">Conventional</option>
                          <option value="procesandose">Procesandose</option>
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

      {/* Edit Modal */}
      {editGroupId && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Group</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditGroupId(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Client Name</label>
                  <input
                    className="form-control"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditGroupId(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const group = pickupGroups.find(
                      (g) => g.id === editGroupId
                    );
                    if (group) {
                      await updatePickupGroupStatus(group.id, group.status); // status unchanged
                      await import("../firebase").then(({ db }) =>
                        import("firebase/firestore").then(
                          ({ doc, updateDoc }) =>
                            updateDoc(doc(db, "pickup_groups", group.id), {
                              clientName: editGroupName,
                            })
                        )
                      );
                    }
                    setEditGroupId(null);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation */}
      {deletingGroupId && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Group</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeletingGroupId(null)}
                ></button>
              </div>
              <div className="modal-body">
                Are you sure you want to delete this group?
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setDeletingGroupId(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await import("../firebase").then(({ db }) =>
                      import("firebase/firestore").then(({ doc, updateDoc }) =>
                        updateDoc(doc(db, "pickup_groups", deletingGroupId), {
                          status: "deleted",
                        })
                      )
                    );
                    setDeletingGroupId(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="col-lg-4 col-md-6 mb-4"
              onMouseEnter={() => setHoveredInvoiceId(invoice.id)}
              onMouseLeave={() => setHoveredInvoiceId(null)}
            >
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">
                    Invoice #{invoice.id}
                    {hoveredInvoiceId === invoice.id && (
                      <span className="badge bg-info text-dark ms-2">
                        {invoice.status}
                      </span>
                    )}
                  </h5>
                  <p className="card-text">
                    Client:{" "}
                    {clients.find((c) => c.id === invoice.clientId)?.name}
                  </p>
                  <p className="card-text">
                    Products:{" "}
                    {invoice.carts
                      .flatMap((cart) => cart.items)
                      .map((item) => `${item.productName} (x${item.quantity})`)
                      .join(", ")}
                  </p>
                  <p className="card-text">
                    Total: ${" "}
                    {invoice.carts
                      .flatMap((cart) => cart.items)
                      .reduce(
                        (total, item) => total + item.price * item.quantity,
                        0
                      )
                      .toFixed(2)}
                  </p>
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
                  const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
                  if (!invoice) return null;
                  return (
                    <>
                      {invoice.carts.map((cart) => (
                        <div key={cart.id} className="mb-3 border rounded p-2">
                          <div className="fw-bold mb-2">{cart.name}</div>
                          {cart.items.length === 0 ? (
                            <div className="text-muted">No products in cart.</div>
                          ) : (
                            cart.items.map((item) => (
                              <div
                                key={item.productId}
                                className="d-flex justify-content-between align-items-center py-2"
                              >
                                <div>
                                  {item.productName} (x{item.quantity})
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <div>${(item.price * item.quantity).toFixed(2)}</div>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    title="Delete entry"
                                    onClick={() => handleDeleteCartItem(cart.id, item.productId)}
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
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
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
                <div className="d-flex justify-content-end">
                  <button
                    className="btn btn-primary me-2"
                    onClick={handleAddToCart}
                  >
                    Add to Cart
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleCartAssign}
                  >
                    {isCreatingCart ? "Create Cart" : "Assign to Cart"}
                  </button>
                </div>
                <div className="mt-4">
                  <h6>Or add products using the keypad:</h6>
                  <div className="row">
                    {products.map((product) => (
                      <div
                        key={product.id}
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
        <div className="modal show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Product to Group</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddProductModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Select Client</label>
                  <select
                    className="form-select"
                    value={addProductGroup.clientId || ''}
                    disabled
                  >
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Select Product</label>
                  <select
                    className="form-select"
                    value={selectedAddProductId}
                    onChange={e => setSelectedAddProductId(e.target.value)}
                  >
                    <option value="">-- Select a product --</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>{product.name}</option>
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
                        checked={addProductMode === 'cart'}
                        onChange={() => setAddProductMode('cart')}
                      />
                      <label className="form-check-label" htmlFor="addByCart">Carts</label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByQty"
                        value="quantity"
                        checked={addProductMode === 'quantity'}
                        onChange={() => setAddProductMode('quantity')}
                      />
                      <label className="form-check-label" htmlFor="addByQty">Quantity</label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByLbs"
                        value="pounds"
                        checked={addProductMode === 'pounds'}
                        onChange={() => setAddProductMode('pounds')}
                      />
                      <label className="form-check-label" htmlFor="addByLbs">Pounds</label>
                    </div>
                  </div>
                </div>
                {addProductMode === 'cart' && (
                  <div className="mb-3">
                    <label className="form-label">Select Cart</label>
                    <select
                      className="form-select"
                      value={selectedCartId}
                      onChange={e => setSelectedCartId(e.target.value)}
                    >
                      <option value="">-- Select a cart --</option>
                      {(addProductGroup.carts || []).map((cart: any) => (
                        <option key={cart.id} value={cart.id}>{cart.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(addProductMode === 'quantity' || addProductMode === 'pounds') && (
                  <div className="mb-3">
                    <label className="form-label">{addProductMode === 'quantity' ? 'Quantity' : 'Pounds'}</label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      value={addProductQty}
                      onChange={e => setAddProductQty(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddProductModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={
                    !selectedAddProductId ||
                    (addProductMode === 'cart' && !selectedCartId) ||
                    ((addProductMode === 'quantity' || addProductMode === 'pounds') && addProductQty < 1)
                  }
                  onClick={async () => {
                    const product = products.find(p => p.id === selectedAddProductId);
                    if (!product) return;
                    let updatedCarts = [...(addProductGroup.carts || [])];
                    if (addProductMode === 'cart') {
                      const cartIdx = updatedCarts.findIndex((c: any) => c.id === selectedCartId);
                      if (cartIdx === -1) return;
                      const cart = { ...updatedCarts[cartIdx] };
                      const existingItemIdx = cart.items.findIndex((item: any) => item.productId === product.id);
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
                      // For quantity or pounds, create a new cart entry
                      const newCart = {
                        id: Date.now().toString(),
                        name: `${addProductMode === 'quantity' ? 'Qty' : 'Lbs'} Cart - ${new Date().toLocaleTimeString()}`,
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
                    // Update in Firestore directly
                    await import("../firebase").then(({ db }) =>
                      import("firebase/firestore").then(({ doc, updateDoc }) =>
                        updateDoc(doc(db, "pickup_groups", addProductGroup.id), { carts: updatedCarts })
                      )
                    );
                    setPickupGroups(prev => prev.map(g => g.id === addProductGroup.id ? { ...g, carts: updatedCarts } : g));
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
        <div className="modal show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Product to Group</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddToGroupModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Client</label>
                  <select className="form-select" value={addToGroupClientId} onChange={e => setAddToGroupClientId(e.target.value)}>
                    <option value="">-- Select a client --</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Product</label>
                  <select className="form-select" value={addToGroupProductId} onChange={e => setAddToGroupProductId(e.target.value)}>
                    <option value="">-- Select a product --</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Mode</label>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="mode-carts" name="addToGroupMode" value="carts" checked={addToGroupMode === "carts"} onChange={() => setAddToGroupMode("carts")} />
                    <label className="form-check-label" htmlFor="mode-carts">Carts</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="mode-quantity" name="addToGroupMode" value="quantity" checked={addToGroupMode === "quantity"} onChange={() => setAddToGroupMode("quantity")} />
                    <label className="form-check-label" htmlFor="mode-quantity">Quantity</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" id="mode-pounds" name="addToGroupMode" value="pounds" checked={addToGroupMode === "pounds"} onChange={() => setAddToGroupMode("pounds")} />
                    <label className="form-check-label" htmlFor="mode-pounds">Pounds</label>
                  </div>
                </div>
                {(addToGroupMode === "quantity" || addToGroupMode === "pounds") && (
                  <div className="mb-3">
                    <label className="form-label">{addToGroupMode === "quantity" ? "Quantity" : "Pounds"}</label>
                    <input type="number" className="form-control" min={1} value={addToGroupValue} onChange={e => setAddToGroupValue(Number(e.target.value))} />
                  </div>
                )}
                {addToGroupError && <div className="alert alert-danger">{addToGroupError}</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddToGroupModal(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={addToGroupLoading} onClick={async () => {
                  setAddToGroupError("");
                  setAddToGroupLoading(true);
                  try {
                    if (!addToGroupClientId || !addToGroupProductId || (addToGroupMode !== "carts" && addToGroupValue < 1)) {
                      setAddToGroupError("Please select all fields and enter a valid value.");
                      setAddToGroupLoading(false);
                      return;
                    }
                    // Find the group for this client (Conventional or Tunnel)
                    const group = pickupGroups.find(g => g.clientId === addToGroupClientId && (g.status === "Conventional" || g.status === "Tunnel"));
                    if (!group) {
                      setAddToGroupError("No group found for this client today.");
                      setAddToGroupLoading(false);
                      return;
                    }
                    // Find or create cart
                    let carts = Array.isArray(group.carts) ? [...group.carts] : [];
                    let cartId = carts.length > 0 ? carts[0].id : Date.now().toString();
                    let cartIdx = carts.findIndex((c: any) => c.id === cartId);
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
                    const product = products.find(p => p.id === addToGroupProductId);
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
                      item.quantity = addToGroupValue; // You may want to store this as pounds in a separate field
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
                    await import("../firebase").then(({ db }) =>
                      import("firebase/firestore").then(({ doc, updateDoc }) =>
                        updateDoc(doc(db, "pickup_groups", group.id), { carts })
                      )
                    );
                    setPickupGroups(prev => prev.map(g => g.id === group.id ? { ...g, carts } : g));
                    setShowAddToGroupModal(false);
                  } catch (err: any) {
                    setAddToGroupError(err.message || "Error adding product to group");
                  } finally {
                    setAddToGroupLoading(false);
                  }
                }}>Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
