import React, { useState, useEffect } from "react";
import { getClients } from "../services/firebaseService";
import { doc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import type { Client, Product } from "../types";
import { addManualConventionalProduct } from "../services/firebaseService";
import { getManualConventionalProductsForDate } from "../services/firebaseService";

interface WashingProps {
  setSelectedInvoiceId?: (id: string | null) => void;
}

const Washing: React.FC<WashingProps> = ({ setSelectedInvoiceId }) => {
  const [activeTab, setActiveTab] = useState<"tunnel" | "conventional">(
    "tunnel"
  );
  const [groups, setGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTunnelGroup, setSelectedTunnelGroup] = useState<any | null>(
    null
  );
  const [tunnelCartInput, setTunnelCartInput] = useState("");
  const [tunnelCartError, setTunnelCartError] = useState("");

  // Per-group state for verification and cart counting
  const [verifiedGroups, setVerifiedGroups] = useState<{
    [groupId: string]: boolean;
  }>({});
  const [cartCounters, setCartCounters] = useState<{
    [groupId: string]: number;
  }>({});
  const [pickupEntries, setPickupEntries] = useState<any[]>([]); // <-- NEW

  // Modal state for adding conventional clients/products
  const [showAddConventionalModal, setShowAddConventionalModal] =
    useState(false);
  const [selectedConventionalClientId, setSelectedConventionalClientId] =
    useState("");
  const [selectedConventionalCartId, setSelectedConventionalCartId] =
    useState("");
  const [selectedConventionalProductId, setSelectedConventionalProductId] =
    useState("");
  const [conventionalProductQty, setConventionalProductQty] = useState(1);
  const [conventionalModalError, setConventionalModalError] = useState("");
  const [conventionalModalLoading, setConventionalModalLoading] =
    useState(false);
  const [conventionalModalCarts, setConventionalModalCarts] = useState<any[]>(
    []
  );
  const [conventionalAddMode, setConventionalAddMode] = useState<
    "cart" | "quantity" | "pounds"
  >("cart");

  // State for manual conventional products
  const [manualConventionalProducts, setManualConventionalProducts] = useState<
    any[]
  >([]);
  const [manualProductsLoading, setManualProductsLoading] = useState(true);

  // Red alert overlay state for tunnel cart count mismatch
  const [showTunnelRedAlert, setShowTunnelRedAlert] = useState(false);
  const tunnelRedAlertTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLoading(true);
    // Load ALL pickup_groups (no date filter)
    const q = collection(db, "pickup_groups");
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime:
            data.startTime instanceof Timestamp
              ? data.startTime.toDate()
              : new Date(data.startTime),
          endTime:
            data.endTime instanceof Timestamp
              ? data.endTime.toDate()
              : new Date(data.endTime),
        };
      });
      setGroups(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const fetchedClients = await getClients();
      setClients(fetchedClients);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Fetch today's pickup entries for cart counting in Conventional tab
  useEffect(() => {
    // Get today's date range in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const q = query(
      collection(db, "pickup_entries"),
      where("timestamp", ">=", Timestamp.fromDate(today)),
      where("timestamp", "<", Timestamp.fromDate(tomorrow))
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp:
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate()
              : new Date(data.timestamp),
        };
      });
      setPickupEntries(fetched);
    });
    return () => unsub();
  }, []);

  // Fetch products for modal
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await import("../services/firebaseService");
        if (res.getProducts) {
          const prods = await res.getProducts();
          setProducts(prods);
        }
      } catch (e) {
        setProducts([]);
      }
    };
    fetchProducts();
  }, []);

  // Helper to get client segregation and washing type
  const getClient = (clientId: string) =>
    clients.find((c) => c.id === clientId);
  const getSegregatedCarts = (group: any) => {
    const client = getClient(group.clientId);
    if (
      client &&
      client.segregation === false &&
      client.washingType === "Tunnel"
    ) {
      // Always use segregatedCarts if present, otherwise fallback to carts length/number
      if (typeof group.segregatedCarts === "number")
        return group.segregatedCarts;
      if (Array.isArray(group.carts)) return group.carts.length;
      if (typeof group.carts === "number") return group.carts;
      return 0;
    }
    // If segregatedCarts is null or undefined, fallback to 0
    return typeof group.segregatedCarts === "number"
      ? group.segregatedCarts
      : 0;
  };
  // Helper to get client washing type
  const getWashingType = (clientId: string) => getClient(clientId)?.washingType;

  // Only show groups with status 'Tunnel' and not 'Entregado' in Tunnel tab
  // Show ALL Tunnel groups regardless of date or delivery status
  const tunnelGroups = groups.filter(
    (g) => g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel"
  );
  // Only show groups with status 'Conventional' and not 'Entregado' in Conventional tab
  const conventionalGroups = groups
    .filter(
      (g) =>
        g.status === "Conventional" &&
        getWashingType(g.clientId) === "Conventional" &&
        g.status !== "Entregado"
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); // Sort by order property

  const manualProductGroups = manualConventionalProducts
    .filter((p) => !p.invoiceId)
    .map((p, idx) => ({
      ...p,
      isManualProduct: true,
      order: p.order ?? conventionalGroups.length + idx,
    }));

  // Merge and sort both lists
  const allConventionalRows = [
    ...conventionalGroups.map((g) => ({ ...g, isManualProduct: false })),
    ...manualProductGroups,
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Helper: count carts for a group from pickup entries
  const getConventionalCartCount = (groupId: string) =>
    pickupEntries.filter((e) => e.groupId === groupId).length;

  // Load verification and counter state from Firestore on mount and when tunnelGroups change
  useEffect(() => {
    // Build new state objects from tunnelGroups
    const newVerifiedGroups: { [groupId: string]: boolean } = {};
    const newCartCounters: { [groupId: string]: number } = {};
    tunnelGroups.forEach((group) => {
      if (group.tunnelVerified) {
        newVerifiedGroups[group.id] = true;
      }
      if (typeof group.tunnelCartCount === "number") {
        newCartCounters[group.id] = group.tunnelCartCount;
      }
    });
    // Only update state if changed (prevents UI from being stuck)
    setVerifiedGroups((prev) => {
      let changed = false;
      for (const key in newVerifiedGroups) {
        if (prev[key] !== newVerifiedGroups[key]) changed = true;
      }
      for (const key in prev) {
        if (!(key in newVerifiedGroups)) changed = true;
      }
      return changed ? newVerifiedGroups : prev;
    });
    setCartCounters((prev) => {
      let changed = false;
      for (const key in newCartCounters) {
        if (prev[key] !== newCartCounters[key]) changed = true;
      }
      for (const key in prev) {
        if (!(key in newCartCounters)) changed = true;
      }
      return changed ? newCartCounters : prev;
    });
  }, [tunnelGroups]);

  // Set group status to 'Tunnel' or 'Conventional' when they appear in the respective tab
  useEffect(() => {
    if (!loading) {
      tunnelGroups.forEach((group) => {
        if (group.status !== "Tunnel") {
          import("../services/firebaseService").then(
            ({ updatePickupGroupStatus }) => {
              updatePickupGroupStatus(group.id, "Tunnel");
            }
          );
        }
      });
      conventionalGroups.forEach((group) => {
        if (group.status !== "Conventional") {
          import("../services/firebaseService").then(
            ({ updatePickupGroupStatus }) => {
              updatePickupGroupStatus(group.id, "Conventional");
            }
          );
        }
      });
    }
    // eslint-disable-next-line
  }, [loading, tunnelGroups.length, conventionalGroups.length]);

  // Helper: get clients not already in a conventional group today
  const clientsNotInConventional = clients.filter(
    (client) => !conventionalGroups.some((g) => g.clientId === client.id)
  );

  // Helper: get carts for a group
  const getGroupCarts = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group && Array.isArray(group.carts) ? group.carts : [];
  };

  // Add/Update product in cart for a group
  const handleAddConventionalProduct = async () => {
    setConventionalModalError("");
    setConventionalModalLoading(true);
    try {
      if (
        !selectedConventionalClientId ||
        !selectedConventionalProductId ||
        conventionalProductQty < 1
      ) {
        setConventionalModalError(
          "Please select all fields and enter a valid quantity."
        );
        setConventionalModalLoading(false);
        return;
      }
      // Find client and product
      const client = clients.find((c) => c.id === selectedConventionalClientId);
      const product = products.find(
        (p) => p.id === selectedConventionalProductId
      );
      if (!client) throw new Error("Client not found");
      if (!product) throw new Error("Product not found");
      // Save manual product entry
      await addManualConventionalProduct({
        clientId: client.id,
        clientName: client.name,
        productId: product.id,
        productName: product.name,
        quantity: conventionalProductQty,
        type:
          conventionalAddMode === "cart"
            ? "cart"
            : conventionalAddMode === "quantity"
            ? "qty"
            : "lbs",
        createdAt: new Date(),
      });
      setShowAddConventionalModal(false);
      setSelectedConventionalClientId("");
      setSelectedConventionalCartId("");
      setSelectedConventionalProductId("");
      setConventionalProductQty(1);
      setConventionalModalError("");
      setConventionalModalLoading(false);
      // Optionally show a toast or success message
      alert("Manual product added successfully!");
    } catch (err: any) {
      setConventionalModalError(err.message || "Error adding manual product");
      setConventionalModalLoading(false);
    }
  };

  // --- Conventional Group Reordering ---
  // Ensure groups have an 'order' property for sorting
  useEffect(() => {
    // If any conventional group is missing 'order', assign it based on current order
    if (conventionalGroups.some((g) => typeof g.order !== "number")) {
      setGroups((prev) => {
        let changed = false;
        const updated = prev.map((g, idx) => {
          if (
            g.status === "Conventional" &&
            getWashingType(g.clientId) === "Conventional" &&
            typeof g.order !== "number"
          ) {
            changed = true;
            return { ...g, order: idx };
          }
          return g;
        });
        return changed ? updated : prev;
      });
    }
    // eslint-disable-next-line
  }, [conventionalGroups.length]);

  // Move group up/down in order
  const moveConventionalGroup = async (
    groupId: string,
    direction: "up" | "down"
  ) => {
    setGroups((prevGroups) => {
      const conventional = prevGroups.filter(
        (g) =>
          g.status === "Conventional" &&
          getWashingType(g.clientId) === "Conventional" &&
          g.status !== "Entregado"
      );
      const others = prevGroups.filter(
        (g) =>
          g.status !== "Conventional" ||
          getWashingType(g.clientId) !== "Conventional" ||
          g.status === "Entregado"
      );
      // Sort by order or fallback to index
      const sorted = [...conventional].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      const idx = sorted.findIndex((g) => g.id === groupId);
      if (idx === -1) return prevGroups;
      let newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sorted.length) return prevGroups;
      // Swap order values
      const tempOrder = sorted[idx].order ?? idx;
      sorted[idx].order = sorted[newIdx].order ?? newIdx;
      sorted[newIdx].order = tempOrder;
      // Persist order changes to Firestore
      (async () => {
        try {
          await Promise.all([
            updateDoc(doc(db, "pickup_groups", sorted[idx].id), {
              order: sorted[idx].order,
            }),
            updateDoc(doc(db, "pickup_groups", sorted[newIdx].id), {
              order: sorted[newIdx].order,
            }),
          ]);
        } catch (e) {
          // Optionally handle error
        }
      })();
      // Rebuild groups array
      const newGroups = [...others, ...sorted];
      return newGroups;
    });
  };

  // Move up/down for both manual products and client groups
  const moveConventionalRow = async (id: string, direction: "up" | "down") => {
    // If it's a manual product, just reorder in local state (optional: persist order if needed)
    const manualIdx = manualConventionalProducts.findIndex((p) => p.id === id);
    if (manualIdx !== -1) {
      setManualConventionalProducts((prev) => {
        const arr = [...prev];
        const newIdx = direction === "up" ? manualIdx - 1 : manualIdx + 1;
        if (newIdx < 0 || newIdx >= arr.length) return arr;
        [arr[manualIdx], arr[newIdx]] = [arr[newIdx], arr[manualIdx]];
        return arr;
      });
      // Optionally: persist order to Firestore if needed
      return;
    }
    // Otherwise, it's a client group
    await moveConventionalGroup(id, direction);
  };

  // Delete a conventional group instantly and update UI immediately
  const handleDeleteConventionalGroup = async (groupId: string) => {
    // Optimistically update UI
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try {
      await updateDoc(doc(db, "pickup_groups", groupId), { status: "deleted" });
    } catch (e) {
      // Optionally, show error and revert UI if needed
      // For now, do nothing (UI stays in sync with Firestore on next snapshot)
    }
  };

  // Delete manual product
  const handleDeleteManualProductGroup = async (id: string) => {
    if (!window.confirm("Delete this manual product?")) return;
    try {
      const { deleteDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      await deleteDoc(doc(db, "manual_conventional_products", id));
      setManualConventionalProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert("Error deleting manual product");
    }
  };

  // Fetch manual conventional products for today
  useEffect(() => {
    let mounted = true;
    getManualConventionalProductsForDate(new Date()).then((products) => {
      if (mounted) {
        setManualConventionalProducts(products.filter((p: any) => !p.washed));
        setManualProductsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Handler to mark manual product as washed (but keep in list until invoiced)
  const handleMarkManualProductWashed = async (id: string) => {
    await updateDoc(doc(db, "manual_conventional_products", id), {
      washed: true,
    });
    setManualConventionalProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, washed: true } : p))
    );
  };

  // Handler to mark a conventional client group as washed
  const handleMarkConventionalGroupWashed = async (group: any) => {
    // 1. Update pickup group status to 'Empaque'
    await updateDoc(doc(db, "pickup_groups", group.id), {
      status: "Empaque",
      washed: true,
    });
    // 2. Create an invoice for the client
    const { addInvoice } = await import("../services/firebaseService");
    const newInvoice = {
      clientId: group.clientId,
      clientName: group.clientName,
      date: new Date().toISOString(),
      products: [], // You may want to fill this with group products if available
      total: 0,
      carts: group.carts || [],
      totalWeight: group.totalWeight || 0,
    };
    const invoiceId = await addInvoice(newInvoice);
    if (setSelectedInvoiceId) setSelectedInvoiceId(invoiceId);
  };

  // Handler to mark a client group as washed (set to Empaque and create invoice)
  const handleMarkGroupAsWashed = async (group: any) => {
    try {
      // Update group status to Empaque
      await updateDoc(doc(db, "pickup_groups", group.id), {
        status: "Empaque",
        washed: true,
      });
      // Create invoice for this group
      const { addInvoice } = await import("../services/firebaseService");
      const newInvoice = {
        clientId: group.clientId,
        clientName: group.clientName,
        date: new Date().toISOString(),
        products: [], // You may want to add group products if available
        total: 0,
        carts: group.carts || [],
        totalWeight: group.totalWeight || 0,
        pickupGroupId: group.id,
      };
      const invoiceId = await addInvoice(newInvoice);
      if (setSelectedInvoiceId) setSelectedInvoiceId(invoiceId);
      // Update local state
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id ? { ...g, status: "Empaque", washed: true } : g
        )
      );
    } catch (e) {
      alert("Error marking group as washed and creating invoice");
    }
  };

  // Automatically sync segregatedCarts for Tunnel/no-segregation clients
  useEffect(() => {
    if (!loading && groups.length > 0 && clients.length > 0) {
      groups.forEach(async (group) => {
        const client = clients.find((c) => c.id === group.clientId);
        if (
          client &&
          client.washingType === "Tunnel" &&
          client.segregation === false
        ) {
          let cartCount = 0;
          if (typeof group.numCarts === "number") cartCount = group.numCarts;
          else if (Array.isArray(group.carts)) cartCount = group.carts.length;
          else if (typeof group.carts === "number") cartCount = group.carts;
          if (group.segregatedCarts !== cartCount) {
            await updateDoc(doc(db, "pickup_groups", group.id), {
              segregatedCarts: cartCount,
            });
            setGroups((prev) =>
              prev.map((g) =>
                g.id === group.id ? { ...g, segregatedCarts: cartCount } : g
              )
            );
          }
        }
      });
    }
    // eslint-disable-next-line
  }, [loading, groups, clients]);

  return (
    <div className="container py-4">
      <h2 className="mb-4 text-center">Washing</h2>
      <ul className="nav nav-tabs mb-3 justify-content-center">
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === "tunnel" ? " active" : ""}`}
            onClick={() => setActiveTab("tunnel")}
          >
            <span style={{ color: "black" }}>Tunnel</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${
              activeTab === "conventional" ? " active" : ""
            }`}
            onClick={() => setActiveTab("conventional")}
          >
            <span style={{ color: "black" }}>Conventional</span>
          </button>
        </li>
      </ul>
      <div>
        {activeTab === "tunnel" && (
          <div
            className="card shadow p-4 mb-4 mx-auto"
            style={{ maxWidth: 600 }}
          >
            <h5 className="mb-4 text-center" style={{ letterSpacing: 1 }}>
              Groups for Tunnel Washing
            </h5>
            {loading ? (
              <div className="text-center py-5">Loading...</div>
            ) : tunnelGroups.length === 0 ? (
              <div className="text-muted text-center py-5">
                No tunnel groups ready for washing.
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {tunnelGroups.map((group) => {
                  const isSelected =
                    selectedTunnelGroup && selectedTunnelGroup.id === group.id;
                  const isVerified = !!verifiedGroups[group.id];
                  const cartCounter = cartCounters[group.id] || 0;
                  const isLocked =
                    group.showInTunnel && group.segregationComplete;
                  const maxCarts = getSegregatedCarts(group);
                  return (
                    <div
                      key={group.id}
                      className="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded"
                      style={{
                        background: isLocked ? "#cce5ff" : "#f8f9fa", // light blue for lock mode
                        border: "1px solid #e3e3e3",
                      }}
                    >
                      <div className="d-flex flex-column flex-md-row align-items-md-center gap-3 flex-grow-1">
                        <span
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: 600,
                            color: "#007bff",
                            minWidth: 120,
                          }}
                        >
                          {group.clientName}
                        </span>
                        <span style={{ fontSize: "1.1rem", color: "#28a745" }}>
                          Total:{" "}
                          <strong>
                            {typeof group.totalWeight === "number"
                              ? group.totalWeight.toFixed(2)
                              : "?"}{" "}
                            lbs
                          </strong>
                        </span>
                        {/* If locked, skip verification and show counter directly */}
                        {isLocked ? (
                          <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: "1.1rem", color: "#333" }}>
                              {cartCounter} / {maxCarts}
                            </span>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              disabled={cartCounter >= maxCarts}
                              onClick={async () => {
                                const newCount = Math.min(
                                  cartCounter + 1,
                                  maxCarts
                                );
                                setCartCounters((prev) => ({
                                  ...prev,
                                  [group.id]: newCount,
                                }));
                                await updateDoc(
                                  doc(db, "pickup_groups", group.id),
                                  {
                                    tunnelCartCount: newCount,
                                  }
                                );
                              }}
                            >
                              +
                            </button>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              disabled={cartCounter <= 0}
                              onClick={async () => {
                                const newCount = Math.max(cartCounter - 1, 0);
                                setCartCounters((prev) => ({
                                  ...prev,
                                  [group.id]: newCount,
                                }));
                                await updateDoc(
                                  doc(db, "pickup_groups", group.id),
                                  {
                                    tunnelCartCount: newCount,
                                  }
                                );
                              }}
                            >
                              -
                            </button>
                            {cartCounter === maxCarts && (
                              <button
                                className="btn btn-success btn-sm ms-2"
                                onClick={async () => {
                                  // Only allow if value matches segregatedCarts
                                  if (cartCounter !== maxCarts) {
                                    alert(
                                      "Error: The number of carts does not match the segregation value."
                                    );
                                    return;
                                  }
                                  const { updatePickupGroupStatus } =
                                    await import("../services/firebaseService");
                                  await updatePickupGroupStatus(
                                    group.id,
                                    "procesandose"
                                  );
                                  await updateDoc(
                                    doc(db, "pickup_groups", group.id),
                                    {
                                      showInTunnel: false,
                                      segregationComplete: false,
                                    }
                                  );
                                  setSelectedTunnelGroup(null);
                                  setTunnelCartInput("");
                                  setTunnelCartError("");
                                }}
                              >
                                Done
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Verification step: input for cart count */}
                            {!isVerified && isSelected && (
                              <>
                                <div className="mb-2 text-secondary small">
                                  Segregated Carts:{" "}
                                  <strong>{getSegregatedCarts(group)}</strong>
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  className="form-control form-control-sm"
                                  style={{ width: 110, maxWidth: "100%" }}
                                  placeholder="How many carts did you count?"
                                  value={tunnelCartInput}
                                  onChange={(e) =>
                                    setTunnelCartInput(e.target.value)
                                  }
                                  autoFocus
                                />
                                {tunnelCartError && (
                                  <div className="text-danger small">
                                    {tunnelCartError}
                                  </div>
                                )}
                                <button
                                  className="btn btn-primary btn-sm ms-2"
                                  onClick={async () => {
                                    const val = parseInt(tunnelCartInput);
                                    if (isNaN(val)) {
                                      setTunnelCartError(
                                        "Please enter a valid number."
                                      );
                                      return;
                                    }
                                    if (val !== getSegregatedCarts(group)) {
                                      setTunnelCartError(
                                        `Cart count does not match segregation value (${getSegregatedCarts(
                                          group
                                        )}).`
                                      );
                                      setShowTunnelRedAlert(true);
                                      if (tunnelRedAlertTimerRef.current)
                                        clearTimeout(
                                          tunnelRedAlertTimerRef.current
                                        );
                                      tunnelRedAlertTimerRef.current =
                                        setTimeout(() => {
                                          setShowTunnelRedAlert(false);
                                        }, 5000);
                                      return;
                                    }
                                    setTunnelCartError("");
                                    setVerifiedGroups((prev) => ({
                                      ...prev,
                                      [group.id]: true,
                                    }));
                                    setCartCounters((prev) => ({
                                      ...prev,
                                      [group.id]: 0,
                                    }));
                                    // Save verification and counter to Firestore
                                    await updateDoc(
                                      doc(db, "pickup_groups", group.id),
                                      {
                                        tunnelVerified: true,
                                        tunnelCartCount: 0,
                                        segregatedCarts: val, // <-- Ensure segregatedCarts is set to the verified value
                                      }
                                    );
                                  }}
                                >
                                  Verify
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm ms-2"
                                  onClick={() => setSelectedTunnelGroup(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {/* Counting step: show counter if verified */}
                            {isVerified && (
                              <div className="d-flex align-items-center gap-2">
                                <span
                                  style={{ fontSize: "1.1rem", color: "#333" }}
                                >
                                  {cartCounter} / {getSegregatedCarts(group)}
                                </span>
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  disabled={
                                    cartCounter >= getSegregatedCarts(group)
                                  }
                                  onClick={async () => {
                                    const newCount = Math.min(
                                      cartCounter + 1,
                                      getSegregatedCarts(group)
                                    );
                                    setCartCounters((prev) => ({
                                      ...prev,
                                      [group.id]: newCount,
                                    }));
                                    await updateDoc(
                                      doc(db, "pickup_groups", group.id),
                                      {
                                        tunnelCartCount: newCount,
                                      }
                                    );
                                  }}
                                >
                                  +
                                </button>
                                <button
                                  className="btn btn-outline-secondary btn-sm"
                                  disabled={cartCounter <= 0}
                                  onClick={async () => {
                                    const newCount = Math.max(
                                      cartCounter - 1,
                                      0
                                    );
                                    setCartCounters((prev) => ({
                                      ...prev,
                                      [group.id]: newCount,
                                    }));
                                    await updateDoc(
                                      doc(db, "pickup_groups", group.id),
                                      {
                                        tunnelCartCount: newCount,
                                      }
                                    );
                                  }}
                                >
                                  -
                                </button>
                                {cartCounter === getSegregatedCarts(group) && (
                                  <button
                                    className="btn btn-success btn-sm ms-2"
                                    onClick={async () => {
                                      // If locked and segregationComplete, use segregatedCarts as the value
                                      if (
                                        group.showInTunnel &&
                                        group.segregationComplete
                                      ) {
                                        const { updatePickupGroupStatus } =
                                          await import(
                                            "../services/firebaseService"
                                          );
                                        await updatePickupGroupStatus(
                                          group.id,
                                          "procesandose"
                                        );
                                        // Optionally, clear lock and segregationComplete
                                        await updateDoc(
                                          doc(db, "pickup_groups", group.id),
                                          {
                                            showInTunnel: false,
                                            segregationComplete: false,
                                          }
                                        );
                                        setSelectedTunnelGroup(null);
                                        setTunnelCartInput("");
                                        setTunnelCartError("");
                                      } else {
                                        // Always create a new invoice for this group
                                        const {
                                          addInvoice,
                                          updatePickupGroupStatus,
                                        } = await import(
                                          "../services/firebaseService"
                                        );
                                        const newInvoice = {
                                          clientId: group.clientId,
                                          clientName: group.clientName,
                                          date: new Date().toISOString(),
                                          products: [],
                                          total: 0,
                                          carts: [],
                                          totalWeight: group.totalWeight || 0, // Save the group's total weight in the invoice
                                        };
                                        const invoiceId = await addInvoice(
                                          newInvoice
                                        );
                                        await updatePickupGroupStatus(
                                          group.id,
                                          "procesandose"
                                        );
                                        if (setSelectedInvoiceId)
                                          setSelectedInvoiceId(invoiceId);
                                        setSelectedTunnelGroup(null);
                                        setTunnelCartInput("");
                                        setTunnelCartError("");
                                      }
                                    }}
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="d-flex flex-row gap-2 align-items-center">
                        {!isSelected && !isVerified && !isLocked && (
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={async () => {
                              setSelectedTunnelGroup(group);
                              setTunnelCartInput("");
                              setTunnelCartError("");
                              // Always update segregatedCarts in Firestore and local state for Tunnel/no-segregation
                              const client = getClient(group.clientId);
                              if (
                                client &&
                                client.segregation === false &&
                                client.washingType === "Tunnel"
                              ) {
                                const newSegCarts = Array.isArray(group.carts)
                                  ? group.carts.length
                                  : typeof group.carts === "number"
                                  ? group.carts
                                  : 0;
                                await updateDoc(
                                  doc(db, "pickup_groups", group.id),
                                  { segregatedCarts: newSegCarts }
                                );
                                setGroups((prev) =>
                                  prev.map((g) =>
                                    g.id === group.id
                                      ? { ...g, segregatedCarts: newSegCarts }
                                      : g
                                  )
                                );
                              }
                            }}
                          >
                            Count Carts
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {activeTab === "conventional" && (
          <div
            className="card shadow p-4 mb-4 mx-auto"
            style={{ maxWidth: 600 }}
          >
            <form
              className="row g-2 align-items-end mb-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddConventionalProduct();
              }}
            >
              <div className="col-12 col-md-4">
                <label className="form-label mb-1">Client</label>
                <select
                  className="form-select"
                  value={selectedConventionalClientId}
                  onChange={(e) =>
                    setSelectedConventionalClientId(e.target.value)
                  }
                  required
                >
                  <option value="">-- Select a client --</option>
                  {clientsNotInConventional.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label mb-1">Product</label>
                <select
                  className="form-select"
                  value={selectedConventionalProductId}
                  onChange={(e) =>
                    setSelectedConventionalProductId(e.target.value)
                  }
                  required
                >
                  <option value="">-- Select a product --</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label mb-1">Add By</label>
                <div className="d-flex gap-2">
                  <div className="form-check form-check-inline">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="addByMode"
                      id="addByCart"
                      value="cart"
                      checked={conventionalAddMode === "cart"}
                      onChange={() => setConventionalAddMode("cart")}
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
                      checked={conventionalAddMode === "quantity"}
                      onChange={() => setConventionalAddMode("quantity")}
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
                      checked={conventionalAddMode === "pounds"}
                      onChange={() => setConventionalAddMode("pounds")}
                    />
                    <label className="form-check-label" htmlFor="addByLbs">
                      Pounds
                    </label>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label mb-1">
                  {conventionalAddMode === "cart"
                    ? "Number of Carts"
                    : conventionalAddMode === "quantity"
                    ? "Quantity"
                    : "Pounds"}
                </label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  value={conventionalProductQty}
                  onChange={(e) =>
                    setConventionalProductQty(Number(e.target.value))
                  }
                  required
                />
              </div>
              <div className="col-12 col-md-4 d-flex align-items-end">
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={
                    !selectedConventionalClientId ||
                    !selectedConventionalProductId ||
                    conventionalProductQty < 1 ||
                    conventionalModalLoading
                  }
                >
                  + Add Manual Product
                </button>
              </div>
              {conventionalModalError && (
                <div className="col-12">
                  <div className="alert alert-danger py-1 my-1">
                    {conventionalModalError}
                  </div>
                </div>
              )}
            </form>
            {manualProductsLoading ? (
              <div className="text-center py-2">Loading manual products...</div>
            ) : (
              manualConventionalProducts.length > 0 && (
                <div className="list-group mb-3">
                  {manualConventionalProducts
                    .filter((p) => !p.invoiceId)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="list-group-item d-flex flex-row align-items-center justify-content-between gap-2 py-2 mb-1 shadow-sm rounded bg-warning bg-opacity-25"
                        style={{ border: "1px solid #ffe066" }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: "#b8860b" }}>
                            {item.clientName}
                          </span>
                          <span style={{ marginLeft: 8 }}>
                            <b>{item.productName}</b> x{item.quantity}{" "}
                            <span style={{ color: "#888" }}>({item.type})</span>
                          </span>
                        </div>
                        {!item.washed && (
                          <button
                            className="btn btn-outline-success btn-sm"
                            onClick={() =>
                              handleMarkManualProductWashed(item.id)
                            }
                          >
                            Mark as Washed
                          </button>
                        )}
                        {item.washed && (
                          <span className="text-muted ms-2">
                            Pending Invoice
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )
            )}
            {loading ? (
              <div className="text-center py-5">Loading...</div>
            ) : conventionalGroups.length === 0 ? (
              <div className="text-muted text-center py-5">
                No conventional groups ready for washing.
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {allConventionalRows.map((group, idx) => {
                  let cartCount = 0,
                    qty = 0,
                    lbs = 0,
                    totalWeight = 0;
                  let showMarkAsWashed = false;
                  if (group.isManualProduct) {
                    showMarkAsWashed = !group.washed;
                  } else {
                    // Calculate totals for display for group rows
                    if (typeof group.carts === "number") {
                      cartCount = group.carts;
                    } else if (Array.isArray(group.carts)) {
                      cartCount = group.carts.length;
                      group.carts.forEach((cart: any) => {
                        const name = (cart.name || "").toLowerCase();
                        if (name.includes("qty")) {
                          qty += (cart.items as any[]).reduce(
                            (sum: number, item: any) =>
                              sum + (item.quantity || 0),
                            0
                          );
                        } else if (name.includes("lbs")) {
                          lbs += (cart.items as any[]).reduce(
                            (sum: number, item: any) =>
                              sum + (item.quantity || 0),
                            0
                          );
                        } else if (
                          Array.isArray(cart.items) &&
                          cart.items.length > 0 &&
                          cart.items.every((item: any) => item.quantity === 1)
                        ) {
                          // already counted in cartCount
                        } else if (Array.isArray(cart.items)) {
                          qty += cart.items.reduce(
                            (sum: number, item: any) =>
                              sum + (item.quantity || 0),
                            0
                          );
                        }
                      });
                    }
                    totalWeight = group.totalWeight || 0;
                    showMarkAsWashed = !group.washed;
                  }
                  return (
                    <div
                      key={group.id}
                      className={`list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded ${
                        group.isManualProduct ? "bg-warning bg-opacity-25" : ""
                      }`}
                      style={
                        group.isManualProduct
                          ? { border: "1px solid #ffe066" }
                          : {
                              background: "#f8f9fa",
                              border: "1px solid #e3e3e3",
                            }
                      }
                    >
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 600,
                          color: group.isManualProduct ? "#b8860b" : "#007bff",
                          minWidth: 120,
                        }}
                      >
                        {group.clientName}
                      </span>
                      <span style={{ fontSize: "1.1rem", color: "#333" }}>
                        {group.isManualProduct ? (
                          <>
                            <b>{group.productName}</b> x{group.quantity}{" "}
                            <span style={{ color: "#888" }}>
                              ({group.type})
                            </span>
                            {/* Removed Washed badge from here */}
                            {cartCount === 0 && qty === 0 && lbs === 0 && (
                              <span className="text-muted">No items</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="badge bg-primary me-2">
                              Carts: {cartCount}
                            </span>
                            <span className="badge bg-info me-2">
                              Total: {totalWeight} lbs
                            </span>
                            {qty > 0 && (
                              <span className="badge bg-success me-2">
                                Qty: {qty}
                              </span>
                            )}
                            {lbs > 0 && (
                              <span className="badge bg-warning text-dark">
                                Lbs: {lbs}
                              </span>
                            )}
                            {group.washed && (
                              <span className="badge bg-success ms-2">
                                Washed
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      <div className="d-flex flex-row gap-1 align-items-center ms-auto">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title="Move up"
                          disabled={idx === 0}
                          onClick={() => moveConventionalRow(group.id, "up")}
                        >
                          <span aria-hidden="true">▲</span>
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title="Move down"
                          disabled={idx === allConventionalRows.length - 1}
                          onClick={() => moveConventionalRow(group.id, "down")}
                        >
                          <span aria-hidden="true">▼</span>
                        </button>
                        {group.isManualProduct && (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            title="Delete manual product"
                            onClick={() =>
                              handleDeleteManualProductGroup(group.id)
                            }
                          >
                            <span aria-hidden="true">🗑️</span>
                          </button>
                        )}
                        {showMarkAsWashed &&
                          (group.isManualProduct ? (
                            <button
                              className="btn btn-outline-success btn-sm ms-2"
                              onClick={() =>
                                handleMarkManualProductWashed(group.id)
                              }
                            >
                              Mark as Washed
                            </button>
                          ) : (
                            <button
                              className="btn btn-outline-success btn-sm ms-2"
                              onClick={() => handleMarkGroupAsWashed(group)}
                            >
                              Mark as Washed
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {showTunnelRedAlert && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(215, 35, 40, 0.97)",
            color: "#fff",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: 2,
            textAlign: "center",
            transition: "opacity 0.3s",
          }}
        >
          <div>
            🚨 <br />
            <span style={{ fontSize: 48 }}>¡ATENCIÓN!</span>
          </div>
          <div style={{ fontSize: 28, marginTop: 24 }}>
            El número de carros ingresado <br />
            <span style={{ color: "#fff", fontWeight: 700 }}>
              NO COINCIDE
            </span>{" "}
            <br />
            con el número de carros segregados.
            <br />
            (El mensaje desaparecerá en 5 segundos)
          </div>
        </div>
      )}
    </div>
  );
};

export default Washing;
