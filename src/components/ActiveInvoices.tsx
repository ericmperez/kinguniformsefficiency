import React, { useEffect, useState, useMemo } from "react";
import { Client, Product, Invoice, CartItem, Cart } from "../types";
import InvoiceForm from "./InvoiceForm";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import {
  getTodayPickupGroups,
  updatePickupGroupStatus,
} from "../services/firebaseService";
import LaundryCartModal from "./LaundryCartModal";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { db } from "../firebase";

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

  // --- Add state for cart selection modal ---
  const [showCartSelectModal, setShowCartSelectModal] = useState(false);
  const [cartSelectCallback, setCartSelectCallback] = useState<null | ((cartId: string) => void)>(null);
  const [cartSelectInvoiceId, setCartSelectInvoiceId] = useState<string | null>(null);

  // --- Add state for selected cart in modal ---
  const [selectedCartForModal, setSelectedCartForModal] = useState<string | null>(null);
  const [newCartNameInput, setNewCartNameInput] = useState("");
  const [creatingCart, setCreatingCart] = useState(false);

  // Add a new state for the cart id being edited in the keypad modal
  const [keypadCartId, setKeypadCartId] = useState<string | null>(null);

  // Placeholder for current user. Replace with actual user logic as needed.
  const currentUser = "Current User";

  // Real-time Firestore listener for today's pickup_groups
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const q = query(
      collection(db, "pickup_groups"),
      where("startTime", ">=", Timestamp.fromDate(today)),
      where("startTime", "<", Timestamp.fromDate(tomorrow))
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Use 'as any' to bypass the type error for status property
      setPickupGroups((fetched as any[]).filter((g) => (g.status || "") !== "deleted"));
      setGroupsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddInvoice = async (invoice: Omit<Invoice, "id">) => {
    try {
      await onAddInvoice(invoice);
      // After invoice is created, set the group status to 'Empaque'
      // Find the pickup group for this client for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      // Get the group for this client today
      const { db } = await import("../firebase");
      const { collection, query, where, getDocs, updateDoc, doc, Timestamp } = await import("firebase/firestore");
      const q = query(
        collection(db, "pickup_groups"),
        where("clientId", "==", invoice.clientId),
        where("startTime", ">=", Timestamp.fromDate(today)),
        where("startTime", "<", Timestamp.fromDate(tomorrow))
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Set all groups for this client today to Empaque
        for (const groupDoc of snap.docs) {
          await updateDoc(doc(db, "pickup_groups", groupDoc.id), { status: "Empaque" });
        }
      }
    } catch (error) {
      console.error("Error adding invoice or updating group status:", error);
    }
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

  // --- Cart selection logic ---
  const handleSelectOrCreateCart = (invoiceId: string, cb: (cartId: string) => void) => {
    setCartSelectInvoiceId(invoiceId);
    setCartSelectCallback(() => cb);
    setShowCartSelectModal(true);
  };

  const handleCartSelected = (cartId: string) => {
    if (cartSelectCallback) cartSelectCallback(cartId);
    setShowCartSelectModal(false);
    setCartSelectCallback(null);
    setCartSelectInvoiceId(null);
  };

  // --- Refactor add product logic to require cart selection ---
  const handleAddProductToCart = (productId: string, quantity: number) => {
    if (!selectedInvoiceId) return;
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;
    // If no carts, force create
    if (!invoice.carts || invoice.carts.length === 0) {
      handleSelectOrCreateCart(selectedInvoiceId, (cartId) => {
        actuallyAddProductToCart(cartId, productId, quantity);
      });
      return;
    }
    // If only one cart, use it
    if (invoice.carts.length === 1) {
      actuallyAddProductToCart(invoice.carts[0].id, productId, quantity);
      return;
    }
    // If multiple carts, prompt selection
    handleSelectOrCreateCart(selectedInvoiceId, (cartId) => {
      actuallyAddProductToCart(cartId, productId, quantity);
    });
  };

  const actuallyAddProductToCart = (cartId: string, productId: string, quantity: number) => {
    if (!selectedInvoiceId) return;
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const carts = invoice.carts ? [...invoice.carts] : [];
    const cartIdx = carts.findIndex((c) => c.id === cartId);
    if (cartIdx === -1) return;
    const cart = { ...carts[cartIdx] };
    const existingItemIdx = cart.items.findIndex((item) => item.productId === productId);
    if (existingItemIdx > -1) {
      cart.items[existingItemIdx].quantity += quantity;
    } else {
      cart.items.push({
        productId: product.id,
        productName: product.name,
        quantity,
        price: product.price,
        addedBy: currentUser,
        addedAt: new Date().toISOString(),
      });
    }
    carts[cartIdx] = cart;
    onUpdateInvoice(selectedInvoiceId, { carts });
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

  // --- Handler for creating a new cart from modal ---
  const handleCreateCartFromModal = async () => {
    if (!selectedInvoiceId || !newCartNameInput.trim()) return;
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;
    const newCart = {
      id: Date.now().toString(),
      name: newCartNameInput.trim(),
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
    };
    await onUpdateInvoice(selectedInvoiceId, { carts: [...(invoice.carts || []), newCart] });
    setSelectedCartForModal(newCart.id);
    setNewCartNameInput("");
    setCreatingCart(false);
  };

  // --- Handler for opening keypad ---
  const handleCartProductCardClick = (cartId: string, product: Product) => {
    setProductForKeypad(product);
    setKeypadQuantity(1);
    setKeypadCartId(cartId);
    setShowProductKeypad(true);
  };

  // --- Handler for confirming keypad add ---
  const handleCartKeypadAdd = () => {
    if (productForKeypad && keypadCartId && keypadQuantity > 0) {
      actuallyAddProductToCart(keypadCartId, productForKeypad.id, keypadQuantity);
      setShowProductKeypad(false);
      setProductForKeypad(null);
      setKeypadCartId(null);
      setKeypadQuantity(1);
    }
  };

  // --- REQUIRED PRODUCTS LOGIC ---
  // For demo: requiredProductsByInvoiceId could be loaded from Firestore or set by Washing.tsx
  // Here, we use a local object for illustration. In production, fetch from Firestore or group definition.
  const [requiredProductsByInvoiceId, setRequiredProductsByInvoiceId] = useState<{[invoiceId: string]: {productId: string, name: string, quantity: number}[]}>({});

  // Helper: get required products for an invoice (not in any cart)
  function getRequiredProductsForInvoice(invoice: Invoice) {
    return requiredProductsByInvoiceId[invoice.id] || [];
  }

  // Helper: check if required products are missing from invoice (not in any cart)
  function invoiceMissingRequiredProducts(invoice: Invoice) {
    const required = getRequiredProductsForInvoice(invoice);
    for (const req of required) {
      // Check if product is present in any cart
      const found = (invoice.carts || []).some(cart =>
        cart.items.some(item => item.productId === req.productId && item.quantity >= req.quantity)
      );
      if (!found) return true;
    }
    return false;
  }

  useEffect(() => {
    // For each invoice, if there is a conventional group for the same client, ensure all carts are present in the invoice
    invoices.forEach((invoice) => {
      const group = pickupGroups.find(
        (g) =>
          g.clientId === invoice.clientId &&
          g.status === "Conventional" &&
          g.carts && Array.isArray(g.carts)
      );
      if (!group) return;
      // Compare carts by id
      const invoiceCartIds = (invoice.carts || []).map((c) => c.id);
      const groupCarts = group.carts || [];
      let needsUpdate = false;
      const mergedCarts = [...(invoice.carts || [])];
      groupCarts.forEach((groupCart: any) => {
        if (!invoiceCartIds.includes(groupCart.id)) {
          mergedCarts.push({ ...groupCart });
          needsUpdate = true;
        } else {
          // If cart exists, check if items match (by productId/quantity)
          const invCart = mergedCarts.find((c) => c.id === groupCart.id);
          if (invCart) {
            // If items differ, update
            const itemsMatch =
              invCart.items.length === groupCart.items.length &&
              invCart.items.every((item: any, idx: number) => {
                const gItem = groupCart.items[idx];
                return (
                  item.productId === gItem.productId &&
                  item.quantity === gItem.quantity
                );
              });
            if (!itemsMatch) {
              invCart.items = [...groupCart.items];
              needsUpdate = true;
            }
          }
        }
      });
      if (needsUpdate) {
        onUpdateInvoice(invoice.id, { carts: mergedCarts });
      }
    });
  }, [invoices, pickupGroups]);

  // Helper: check if invoice is missing any carts/items from the conventional group
  function invoiceMissingConventionalCarts(invoice: Invoice): boolean {
    const group = pickupGroups.find(
      (g) =>
        g.clientId === invoice.clientId &&
        g.status === "Conventional" &&
        g.carts && Array.isArray(g.carts)
    );
    if (!group) return false;
    const invoiceCartIds = (invoice.carts || []).map((c) => c.id);
    const groupCarts = group.carts || [];
    // All group carts must be present in invoice
    for (const groupCart of groupCarts) {
      const invCart = (invoice.carts || []).find((c) => c.id === groupCart.id);
      if (!invCart) return true;
      // Check items
      if (
        invCart.items.length !== groupCart.items.length ||
        !invCart.items.every((item: any, idx: number) => {
          const gItem = groupCart.items[idx];
          return (
            item.productId === gItem.productId &&
            item.quantity === gItem.quantity
          );
        })
      ) {
        return true;
      }
    }
    return false;
  }

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
          <button className="btn btn-primary" onClick={() => setShowInvoiceForm(true)}>
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
                    {clients.find((c) => c.id === invoice.clientId)?.name}
                    <span className="ms-2 text-muted" style={{ fontSize: 16 }}>
                      #{invoice.invoiceNumber}
                    </span>
                    {hoveredInvoiceId === invoice.id && (
                      <span className="badge bg-info text-dark ms-2">
                        {invoice.status}
                      </span>
                    )}
                  </h5>
                  <p className="card-text mb-1">
                    <span className="fw-bold">Date:</span> {new Date(invoice.date).toLocaleDateString()}
                  </p>
                  {/* Show active carts summary */}
                  <div className="mb-2">
                    <span className="fw-bold">Carts:</span>
                    {invoice.carts && invoice.carts.length > 0 ? (
                      <ul className="mb-0 ps-3">
                        {invoice.carts.map(cart => (
                          <li key={cart.id}>
                            <span className="text-primary">{cart.name}</span>
                            {cart.items.length > 0 && (
                              <span className="text-muted ms-2">({cart.items.length} product{cart.items.length !== 1 ? 's' : ''})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted ms-2">No carts</span>
                    )}
                  </div>
                  <p className="card-text">
                    Products: {invoice.carts.flatMap((cart) => cart.items).map((item) => `${item.productName} (x${item.quantity})`).join(", ")}
                  </p>
                  {/* Show required products from the conventional group, if any */}
                  {(() => {
                    const group = pickupGroups.find(
                      (g) =>
                        g.clientId === invoice.clientId &&
                        g.status === "Conventional" &&
                        g.carts && Array.isArray(g.carts)
                    );
                    if (!group || !group.carts || group.carts.length === 0) return null;
                    // Flatten all required products from all carts
                    const requiredProducts: { [key: string]: { name: string; quantity: number } } = {};
                    group.carts.forEach((cart: any) => {
                      cart.items.forEach((item: any) => {
                        if (!requiredProducts[item.productId]) {
                          requiredProducts[item.productId] = { name: item.productName, quantity: 0 };
                        }
                        requiredProducts[item.productId].quantity += item.quantity;
                      });
                    });
                    return (
                      <div className="mt-2">
                        <span className="fw-bold">Required Products:</span>
                        <ul className="mb-0 ps-3">
                          {Object.values(requiredProducts).map((prod) => (
                            <li key={prod.name}>{prod.name} (x{prod.quantity})</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  {(() => {
                    const requiredProducts = getRequiredProductsForInvoice(invoice);
                    if (requiredProducts.length > 0) {
                      return (
                        <div className="mt-2">
                          <span className="fw-bold">Required Products (not in any cart):</span>
                          <ul className="mb-0 ps-3">
                            {requiredProducts.map((prod) => (
                              <li key={prod.productId}>{prod.name} (x{prod.quantity})</li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {invoiceMissingRequiredProducts(invoice) && (
  <div className="alert alert-warning p-2 mt-2 mb-0">
    <strong>Warning:</strong> This invoice is missing one or more required products (not in any cart). Please add them before completing the invoice.
  </div>
)}
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
                <h5 className="modal-title">Invoice Carts</h5>
                <button type="button" className="btn-close" onClick={() => { setShowCartModal(false); setSelectedCartForModal(null); setCreatingCart(false); }}></button>
              </div>
              <div className="modal-body">
                {/* Show all carts and their products */}
                {(() => {
                  const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
                  if (!invoice) return null;
                  // If no cart selected, show cart cards
                  if (!selectedCartForModal && !creatingCart) {
                    return (
                      <div className="row g-3">
                        {invoice.carts.map((cart) => (
                          <div className="col-12 col-md-6 col-lg-4" key={cart.id}>
                            <div className="card h-100 shadow-sm" style={{ cursor: 'pointer', border: '2px solid #007bff' }} onClick={() => setSelectedCartForModal(cart.id)}>
                              <div className="card-body">
                                <h5 className="card-title mb-2">{cart.name}</h5>
                                <div className="text-muted small">{cart.items.length} product{cart.items.length !== 1 ? 's' : ''}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="col-12 col-md-6 col-lg-4">
                          <div className="card h-100 shadow-sm border-dashed" style={{ cursor: 'pointer', border: '2px dashed #28a745' }} onClick={() => setCreatingCart(true)}>
                            <div className="card-body d-flex flex-column justify-content-center align-items-center" style={{ minHeight: 120 }}>
                              <span className="display-6 text-success">+</span>
                              <div className="fw-bold mt-2">Create New Cart</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  // If creating a cart
                  if (creatingCart) {
                    return (
                      <div className="p-3">
                        <h6>Create New Cart</h6>
                        <input type="text" className="form-control mb-2" placeholder="Cart Name" value={newCartNameInput} onChange={e => setNewCartNameInput(e.target.value)} autoFocus />
                        <div className="d-flex gap-2">
                          <button className="btn btn-secondary" onClick={() => { setCreatingCart(false); setNewCartNameInput(""); }}>Cancel</button>
                          <button className="btn btn-success" disabled={!newCartNameInput.trim()} onClick={handleCreateCartFromModal}>Create</button>
                        </div>
                      </div>
                    );
                  }
                  // If a cart is selected, show its products and add-product UI
                  const cart = invoice.carts.find(c => c.id === selectedCartForModal);
                  if (!cart) return null;
                  return (
                    <>
                      <div className="mb-3">
                        <button className="btn btn-link p-0" onClick={() => setSelectedCartForModal(null)}>&larr; Back to carts</button>
                      </div>
                      <div className="mb-3 border rounded p-2">
                        <div className="fw-bold mb-2">{cart.name}</div>
                        {cart.items.length === 0 ? (
                          <div className="text-muted">No products in cart.</div>
                        ) : (
                          cart.items.map((item) => (
                            <div key={item.productId} className="d-flex justify-content-between align-items-center py-2">
                              <div>{item.productName} (x{item.quantity})</div>
                              <button className="btn btn-outline-danger btn-sm" title="Delete entry" onClick={() => handleDeleteCartItem(cart.id, item.productId)}>
                                <span aria-hidden="true">🗑️</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Add Product</label>
                        {/* Carousel for product cards */}
                        <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 8 }}>
                          {products.map((product) => (
                            <div
                              key={product.id}
                              style={{
                                display: 'inline-block',
                                width: 160,
                                marginRight: 12,
                                verticalAlign: 'top',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleCartProductCardClick(cart.id, product)}
                            >
                              <div className="card h-100 text-center" style={{ minHeight: 220 }}>
                                <div style={{ height: 100, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img
                                    src={product.imageUrl || '/images/placeholder-product.png'}
                                    alt={product.name}
                                    style={{ width: 64, height: 64, objectFit: 'contain', opacity: 0.5 }}
                                    onError={e => (e.currentTarget.src = '/images/placeholder-product.png')}
                                  />
                                </div>
                                <div className="card-body p-2">
                                  <div className="fw-bold mb-1" style={{ fontSize: 15 }}>{product.name}</div>
                                  {/* No price, no add button, click opens keypad */}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setShowCartModal(false); setSelectedCartForModal(null); setCreatingCart(false); }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart selection/creation modal */}
      {showCartSelectModal && cartSelectInvoiceId && (
        <LaundryCartModal
          show={showCartSelectModal}
          onClose={() => setShowCartSelectModal(false)}
          carts={(invoices.find(inv => inv.id === cartSelectInvoiceId)?.carts || []).map(c => ({ id: c.id, name: c.name, isActive: true }))}
          onSelect={async (cart) => handleCartSelected(cart.id)}
          onAddCart={async (cartName: string) => {
            // Add new cart to invoice
            if (!cartSelectInvoiceId) throw new Error('No invoice selected');
            const invoice = invoices.find(inv => inv.id === cartSelectInvoiceId);
            if (!invoice) throw new Error('Invoice not found');
            const newCart = { id: Date.now().toString(), name: cartName, items: [], total: 0, createdAt: new Date().toISOString() };
            await onUpdateInvoice(cartSelectInvoiceId, { carts: [...(invoice.carts || []), newCart] });
            return { id: newCart.id, name: newCart.name, isActive: true };
          }}
        />
      )}

      {/* Keypad modal for cart product quantity */}
      {showProductKeypad && productForKeypad && (
        <div className="modal show" style={{ display: 'block', background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add {productForKeypad.name} to Cart</h5>
                <button type="button" className="btn-close" onClick={() => setShowProductKeypad(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={keypadQuantity}
                    onChange={e => setKeypadQuantity(Number(e.target.value))}
                    min={1}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowProductKeypad(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCartKeypadAdd} disabled={keypadQuantity < 1}>Add to Cart</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        show={!!invoiceToDelete}
        onClose={() => setInvoiceToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice #${invoiceToDelete?.invoiceNumber || invoiceToDelete?.id}? This action cannot be undone.`}
        invoice={invoiceToDelete}
      />
    </div>
  );
}
