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
  const [showAddConventionalModal, setShowAddConventionalModal] = useState(false);
  const [selectedConventionalClientId, setSelectedConventionalClientId] = useState("");
  const [selectedConventionalCartId, setSelectedConventionalCartId] = useState("");
  const [selectedConventionalProductId, setSelectedConventionalProductId] = useState("");
  const [conventionalProductQty, setConventionalProductQty] = useState(1);
  const [conventionalModalError, setConventionalModalError] = useState("");
  const [conventionalModalLoading, setConventionalModalLoading] = useState(false);
  const [conventionalModalCarts, setConventionalModalCarts] = useState<any[]>([]);
  const [conventionalAddMode, setConventionalAddMode] = useState<'cart' | 'quantity' | 'pounds'>('cart');

  useEffect(() => {
    setLoading(true);
    // Get today's date range in local time
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
      // Use group.carts or group.carts.length if available
      if (Array.isArray(group.carts)) return group.carts.length;
      if (typeof group.carts === "number") return group.carts;
      return 0;
    }
    return group.segregatedCarts;
  };
  // Helper to get client washing type
  const getWashingType = (clientId: string) => getClient(clientId)?.washingType;

  // Only show groups with status 'Tunnel' and not 'Entregado' in Tunnel tab
  const tunnelGroups = groups.filter(
    (g) =>
      (
        (g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel") ||
        (g.status === "Segregation" && g.showInTunnel === true && getWashingType(g.clientId) === "Tunnel")
      ) &&
      g.status !== "Entregado"
  );
  // Only show groups with status 'Conventional' and not 'Entregado' in Conventional tab
  const conventionalGroups = groups
    .filter(
      (g) =>
        g.status === "Conventional" &&
        g.status !== "Entregado"
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); // Sort by order property

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
    (client) =>
      !groups.some((g) => g.status === "Conventional" && g.clientId === client.id)
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
      if (!selectedConventionalClientId || !selectedConventionalProductId || conventionalProductQty < 1) {
        setConventionalModalError("Please select all fields and enter a valid quantity.");
        setConventionalModalLoading(false);
        return;
      }
      // 1. Find or create group for this client
      let group = groups.find(
        (g) =>
          g.clientId === selectedConventionalClientId &&
          g.status === "Conventional"
      );
      let groupId = group ? group.id : null;
      if (!group) {
        // Create new group
        const client = clients.find((c) => c.id === selectedConventionalClientId);
        if (!client) throw new Error("Client not found");
        const now = new Date();
        const groupData = {
          clientId: client.id,
          clientName: client.name,
          startTime: now,
          endTime: now,
          totalWeight: 0,
          status: "Conventional",
          carts: [],
        };
        const groupRef = await addDoc(collection(db, "pickup_groups"), groupData);
        groupId = groupRef.id;
        group = { ...groupData, id: groupId };
        setGroups((prev) => [...prev, group]);
      }
      // 2. Get or create cart(s) and add product
      let carts = Array.isArray(group.carts) ? [...group.carts] : [];
      const product = products.find((p) => p.id === selectedConventionalProductId);
      if (!product) throw new Error("Product not found");
      if (selectedConventionalCartId) {
        // Add to existing cart
        const cartIdx = carts.findIndex((c) => c.id === selectedConventionalCartId);
        if (cartIdx !== -1) {
          const cart = { ...carts[cartIdx] };
          const items: any[] = cart.items;
          const itemIdx = items.findIndex((item: any) => item.productId === product.id);
          if (itemIdx !== -1) {
            // Increment quantity
            items[itemIdx].quantity += conventionalProductQty;
            items[itemIdx].addedAt = new Date().toISOString();
          } else {
            items.push({
              productId: product.id,
              productName: product.name,
              quantity: conventionalProductQty,
              price: product.price,
              addedBy: "WashingPage",
              addedAt: new Date().toISOString(),
            });
          }
          cart.items = items;
          carts[cartIdx] = cart;
        }
      } else if (conventionalAddMode === 'cart') {
        // Add N carts, each with 1 of the selected product
        for (let i = 0; i < conventionalProductQty; i++) {
          const cartId = Date.now().toString() + '-' + i;
          const newCart = {
            id: cartId,
            name: `Cart ${carts.length + 1}`,
            items: [
              {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                price: product.price,
                addedBy: "WashingPage",
                addedAt: new Date().toISOString(),
              },
            ],
            total: 0,
            createdAt: new Date().toISOString(),
          };
          carts.push(newCart);
        }
      } else {
        // For quantity or pounds, create a new cart entry
        const cartId = Date.now().toString();
        const newCart = {
          id: cartId,
          name: `${conventionalAddMode === 'quantity' ? 'Qty' : 'Lbs'} Cart - ${new Date().toLocaleTimeString()}`,
          items: [
            {
              productId: product.id,
              productName: product.name,
              quantity: conventionalProductQty,
              price: product.price,
              addedBy: "WashingPage",
              addedAt: new Date().toISOString(),
            },
          ],
          total: 0,
          createdAt: new Date().toISOString(),
        };
        carts.push(newCart);
      }
      // 3. Update group in Firestore
      await updateDoc(doc(db, "pickup_groups", groupId), { carts });
      // 4. Update local state
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, carts } : g))
      );
      setShowAddConventionalModal(false);
      setSelectedConventionalClientId("");
      setSelectedConventionalCartId("");
      setSelectedConventionalProductId("");
      setConventionalProductQty(1);
      setConventionalModalError("");
      setConventionalModalLoading(false);
    } catch (err: any) {
      setConventionalModalError(err.message || "Error adding product to cart");
      setConventionalModalLoading(false);
    }
  };

  // --- Conventional Group Reordering ---
  // Ensure groups have an 'order' property for sorting
  useEffect(() => {
    // If any conventional group is missing 'order', assign it based on current order
    if (conventionalGroups.some((g) => typeof g.order !== 'number')) {
      setGroups((prev) => {
        let changed = false;
        const updated = prev.map((g, idx) => {
          if (
            g.status === 'Conventional' &&
            typeof g.order !== 'number'
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
  const moveConventionalGroup = async (groupId: string, direction: 'up' | 'down') => {
    setGroups((prevGroups) => {
      const conventional = prevGroups.filter(
        (g) =>
          g.status === "Conventional" &&
          g.status !== "Entregado"
      );
      const others = prevGroups.filter(
        (g) =>
          g.status !== "Conventional" ||
          g.status === "Entregado"
      );
      // Sort by order or fallback to index
      const sorted = [...conventional].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const idx = sorted.findIndex((g) => g.id === groupId);
      if (idx === -1) return prevGroups;
      let newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sorted.length) return prevGroups;
      // Swap order values
      const tempOrder = sorted[idx].order ?? idx;
      sorted[idx].order = sorted[newIdx].order ?? newIdx;
      sorted[newIdx].order = tempOrder;
      // Persist order changes to Firestore
      (async () => {
        try {
          await Promise.all([
            updateDoc(doc(db, "pickup_groups", sorted[idx].id), { order: sorted[idx].order }),
            updateDoc(doc(db, "pickup_groups", sorted[newIdx].id), { order: sorted[newIdx].order })
          ]);
        } catch (e) {
          // Optionally handle error
        }
      })();
      // Rebuild groups array
      const newGroups = [
        ...others,
        ...sorted
      ];
      return newGroups;
    });
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

  return (
    <div className="container py-4">
      <h2 className="mb-4 text-center">Washing</h2>
      <ul className="nav nav-tabs mb-3 justify-content-center">
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === "tunnel" ? " active" : ""}`}
            onClick={() => setActiveTab("tunnel")}
          >
            Tunnel
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${
              activeTab === "conventional" ? " active" : ""
            }`}
            onClick={() => setActiveTab("conventional")}
          >
            Conventional
          </button>
        </li>
      </ul>
      <div>
        {activeTab === "tunnel" && (
          <div
            className="card shadow p-4 mb-4 mx-auto"
            style={{ maxWidth: 900 }}
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
                  const isLocked = group.showInTunnel && group.segregationComplete;
                  const maxCarts = getSegregatedCarts(group);
                  return (
                    <div
                      key={group.id}
                      className="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded"
                      style={{
                        background: isLocked ? '#cce5ff' : '#f8f9fa', // light blue for lock mode
                        border: '1px solid #e3e3e3',
                      }}
                    >
                      <div className="d-flex flex-column flex-md-row align-items-md-center gap-3 flex-grow-1">
                        <span
                          style={{
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            color: '#007bff',
                            minWidth: 120,
                          }}
                        >
                          {group.clientName}
                        </span>
                        <span style={{ fontSize: '1.1rem', color: '#28a745' }}>
                          Total: <strong>{typeof group.totalWeight === 'number' ? group.totalWeight.toFixed(2) : '?'} lbs</strong>
                        </span>
                        {/* If locked, skip verification and show counter directly */}
                        {isLocked ? (
                          <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: '1.1rem', color: '#333' }}>
                              {cartCounter} / {maxCarts}
                            </span>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              disabled={cartCounter >= maxCarts}
                              onClick={async () => {
                                const newCount = Math.min(cartCounter + 1, maxCarts);
                                setCartCounters((prev) => ({ ...prev, [group.id]: newCount }));
                                await updateDoc(doc(db, 'pickup_groups', group.id), {
                                  tunnelCartCount: newCount,
                                });
                              }}
                            >
                              +
                            </button>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              disabled={cartCounter <= 0}
                              onClick={async () => {
                                const newCount = Math.max(cartCounter - 1, 0);
                                setCartCounters((prev) => ({ ...prev, [group.id]: newCount }));
                                await updateDoc(doc(db, 'pickup_groups', group.id), {
                                  tunnelCartCount: newCount,
                                });
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
                                    alert('Error: The number of carts does not match the segregation value.');
                                    return;
                                  }
                                  const { updatePickupGroupStatus } = await import('../services/firebaseService');
                                  await updatePickupGroupStatus(group.id, 'procesandose');
                                  await updateDoc(doc(db, 'pickup_groups', group.id), {
                                    showInTunnel: false,
                                    segregationComplete: false,
                                  });
                                  setSelectedTunnelGroup(null);
                                  setTunnelCartInput('');
                                  setTunnelCartError('');
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
                                  {(() => {
                                    const client = getClient(group.clientId);
                                    if (client && client.segregation === false && client.washingType === "Tunnel") {
                                      return <>Cart Count: <strong>{getSegregatedCarts(group)}</strong></>;
                                    }
                                    return <>Segregated Carts: <strong>{getSegregatedCarts(group)}</strong></>;
                                  })()}
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  className="form-control form-control-sm"
                                  style={{ width: 110, maxWidth: "100%" }}
                                  placeholder={(() => {
                                    const client = getClient(group.clientId);
                                    if (client && client.segregation === false && client.washingType === "Tunnel") {
                                      return "How many carts did you count?";
                                    }
                                    return "How many segregated carts?";
                                  })()}
                                  value={tunnelCartInput}
                                  onChange={(e) => setTunnelCartInput(e.target.value)}
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
                                    const client = getClient(group.clientId);
                                    const expected = getSegregatedCarts(group);
                                    if (val !== expected) {
                                      setTunnelCartError(
                                        client && client.segregation === false && client.washingType === "Tunnel"
                                          ? `Cart count does not match expected value (${expected} carts).`
                                          : `Cart count does not match segregation value (${expected}).`
                                      );
                                      return;
                                    }
                                    setTunnelCartError("");
                                    setVerifiedGroups((prev) => ({ ...prev, [group.id]: true }));
                                    setCartCounters((prev) => ({ ...prev, [group.id]: 0 }));
                                    // Save verification and counter to Firestore
                                    await updateDoc(doc(db, "pickup_groups", group.id), {
                                      tunnelVerified: true,
                                      tunnelCartCount: 0,
                                    });
                                  }}
                                >
                                  Start Counting
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
                                <span style={{ fontSize: "1.1rem", color: "#333" }}>
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
                                {cartCounter === getSegregatedCarts(group) && (
                                  <button
                                    className="btn btn-success btn-sm ms-2"
                                    onClick={async () => {
                                      // Always create a new invoice for this group when Done is clicked
                                      const { addInvoice, updatePickupGroupStatus } = await import("../services/firebaseService");
                                      const newInvoice = {
                                        clientId: group.clientId,
                                        clientName: group.clientName,
                                        date: new Date().toISOString(),
                                        products: [],
                                        total: 0,
                                        carts: Array.isArray(group.carts) ? group.carts : [],
                                        totalWeight: group.totalWeight || 0,
                                        status: "procesandose",
                                        // invoiceNumber will be auto-assigned in addInvoice
                                      };
                                      const invoiceId = await addInvoice(newInvoice);
                                      await updatePickupGroupStatus(group.id, "procesandose");
                                      if (setSelectedInvoiceId) setSelectedInvoiceId(invoiceId);
                                      setSelectedTunnelGroup(null);
                                      setTunnelCartInput("");
                                      setTunnelCartError("");
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
                            onClick={() => {
                              setSelectedTunnelGroup(group);
                              setTunnelCartInput("");
                              setTunnelCartError("");
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
          <div className="card shadow p-4 mb-4 mx-auto" style={{ maxWidth: 600 }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="text-center mb-0" style={{ letterSpacing: 1 }}>
                Groups for Conventional Washing
              </h5>
              <button
                className="btn btn-success btn-sm"
                title="Add client to conventional"
                onClick={() => {
                  setShowAddConventionalModal(true);
                  setSelectedConventionalClientId("");
                  setSelectedConventionalCartId("");
                  setSelectedConventionalProductId("");
                  setConventionalProductQty(1);
                  setConventionalModalError("");
                }}
              >
                +
              </button>
            </div>
            {loading ? (
              <div className="text-center py-5">Loading...</div>
            ) : conventionalGroups.length === 0 ? (
              <div className="text-muted text-center py-5">
                No conventional groups ready for washing.
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {conventionalGroups.map((group, idx) => {
                  // Collect all products and quantities for this group, and their type (cart/lbs/qty)
                  const productMap: { [productId: string]: { name: string; quantity: number; type: string } } = {};
                  if (Array.isArray(group.carts)) {
                    group.carts.forEach((cart: any) => {
                      let type = 'cart';
                      const name = (cart.name || '').toLowerCase();
                      if (name.includes('qty')) type = 'qty';
                      else if (name.includes('lbs')) type = 'lbs';
                      (cart.items || []).forEach((item: any) => {
                        if (!productMap[item.productId]) {
                          productMap[item.productId] = { name: item.productName, quantity: 0, type };
                        }
                        productMap[item.productId].quantity += item.quantity;
                        // If the same product appears in different cart types, mark as 'mixed'
                        if (productMap[item.productId].type !== type) {
                          productMap[item.productId].type = 'mixed';
                        }
                      });
                    });
                  }
                  return (
                    <div
                      key={group.id}
                      className="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded"
                      style={{
                        background: "#f8f9fa",
                        border: "1px solid #e3e3e3",
                      }}
                    >
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
                      <span style={{ fontSize: "1.1rem", color: "#333" }}>
                        {Object.keys(productMap).length === 0 ? (
                          <span className="text-muted">No products</span>
                        ) : (
                          <>
                            Products: {Object.values(productMap).map((prod, i) => (
                              <span key={prod.name} className="me-2 d-inline-flex align-items-center">
                                <span className="badge bg-secondary">
                                  {prod.name}
                                </span>
                                <span
                                  className={
                                    prod.type === 'cart'
                                      ? 'badge bg-primary ms-1'
                                      : prod.type === 'qty'
                                      ? 'badge bg-success ms-1'
                                      : prod.type === 'lbs'
                                      ? 'badge bg-warning text-dark ms-1'
                                      : 'badge bg-dark ms-1'
                                  }
                                  style={{ fontWeight: 500, fontSize: '0.95em' }}
                                >
                                  {prod.type === 'cart' && 'Cart'}
                                  {prod.type === 'qty' && 'Qty'}
                                  {prod.type === 'lbs' && 'Lbs'}
                                  {prod.type === 'mixed' && 'Mixed'}
                                  : {prod.quantity}
                                </span>
                              </span>
                            ))}
                          </>
                        )}
                      </span>
                      <div className="d-flex flex-row gap-1 align-items-center ms-auto">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title="Move up"
                          disabled={idx === 0}
                          onClick={() => moveConventionalGroup(group.id, 'up')}
                        >
                          <span aria-hidden="true">▲</span>
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title="Move down"
                          disabled={idx === conventionalGroups.length - 1}
                          onClick={() => moveConventionalGroup(group.id, 'down')}
                        >
                          <span aria-hidden="true">▼</span>
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          title="Delete group"
                          onClick={() => handleDeleteConventionalGroup(group.id)}
                        >
                          <span aria-hidden="true">🗑️</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Modal for adding client/product to conventional */}
            {showAddConventionalModal && (
              <div className="modal show" style={{ display: "block", background: "rgba(0,0,0,0.3)" }}>
                <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Add Client/Product to Conventional</h5>
                      <button type="button" className="btn-close" onClick={() => setShowAddConventionalModal(false)}></button>
                    </div>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label">Client</label>
                        <select
                          className="form-select"
                          value={selectedConventionalClientId}
                          onChange={async (e) => {
                            setSelectedConventionalClientId(e.target.value);
                            // Load carts for this group if exists
                            const group = groups.find(
                              (g) =>
                                g.clientId === e.target.value &&
                                g.status === "Conventional" &&
                                getWashingType(g.clientId) === "Conventional"
                            );
                            setConventionalModalCarts(group && Array.isArray(group.carts) ? group.carts : []);
                            setSelectedConventionalCartId("");
                          }}
                        >
                          <option value="">-- Select a client --</option>
                          {clientsNotInConventional
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((client) => (
                              <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Product</label>
                        <select
                          className="form-select"
                          value={selectedConventionalProductId}
                          onChange={(e) => setSelectedConventionalProductId(e.target.value)}
                        >
                          <option value="">-- Select a product --</option>
                          {products.map((product) => (
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
                              checked={conventionalAddMode === 'cart'}
                              onChange={() => setConventionalAddMode('cart')}
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
                              checked={conventionalAddMode === 'quantity'}
                              onChange={() => setConventionalAddMode('quantity')}
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
                              checked={conventionalAddMode === 'pounds'}
                              onChange={() => setConventionalAddMode('pounds')}
                            />
                            <label className="form-check-label" htmlFor="addByLbs">Pounds</label>
                          </div>
                        </div>
                      </div>
                      {conventionalAddMode === 'cart' && (
                        <div className="mb-3">
                          <label className="form-label">Number of Carts</label>
                          <input
                            type="number"
                            className="form-control"
                            min={1}
                            value={conventionalProductQty}
                            onChange={e => setConventionalProductQty(Number(e.target.value))}
                          />
                        </div>
                      )}
                      {(conventionalAddMode === 'quantity' || conventionalAddMode === 'pounds') && (
                        <div className="mb-3">
                          <label className="form-label">{conventionalAddMode === 'quantity' ? 'Quantity' : 'Pounds'}</label>
                          <input
                            type="number"
                            className="form-control"
                            min={1}
                            value={conventionalProductQty}
                            onChange={e => setConventionalProductQty(Number(e.target.value))}
                          />
                        </div>
                      )}
                      {conventionalModalError && <div className="alert alert-danger">{conventionalModalError}</div>}
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={() => setShowAddConventionalModal(false)}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={
                          !selectedConventionalClientId ||
                          !selectedConventionalProductId ||
                          conventionalProductQty < 1
                        }
                        onClick={handleAddConventionalProduct}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Washing;
