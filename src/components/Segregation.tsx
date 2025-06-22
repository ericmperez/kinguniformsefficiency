import React, { useEffect, useState } from "react";
import {
  getTodayPickupGroups,
  updatePickupGroupStatus,
  getClients,
} from "../services/firebaseService";
import type { Client } from "../types";
// Add Firestore imports
import { doc, updateDoc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

interface SegregationProps {
  hideArrows?: boolean;
  onGroupComplete?: () => void;
}

const Segregation: React.FC<SegregationProps> = ({
  hideArrows,
  onGroupComplete,
}) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // State for log modal
  const [logGroup, setLogGroup] = useState<any | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [fetchedGroups, fetchedClients] = await Promise.all([
        getTodayPickupGroups(),
        getClients(),
      ]);
      setGroups(fetchedGroups);
      setClients(fetchedClients);
      setLoading(false);
    };
    fetchData();
    // Optionally, add polling or a real-time listener for groups if needed
  }, [statusUpdating]);

  // Show only groups with status 'Segregation' and not 'Entregado'
  const segregationClientIds = clients
    .filter((c) => c.segregation)
    .map((c) => c.id);
  const segregationGroups = groups.filter(
    (g) =>
      segregationClientIds.includes(g.clientId) && g.status === "Segregation"
  );

  // Only set group status to 'Segregation' if it is in a pre-segregation state (e.g., 'Pickup Complete')
  useEffect(() => {
    if (!loading && groups.length > 0 && clients.length > 0) {
      groups.forEach((group) => {
        const client = clients.find((c) => c.id === group.clientId);
        // Only set to 'Segregation' if client needs segregation and group is in a pre-segregation state
        if (
          client &&
          client.segregation &&
          (group.status === "Recibido" || group.status === undefined)
        ) {
          updatePickupGroupStatus(group.id, "Segregation");
        }
      });
    }
  }, [loading, groups.length, clients.length]);

  // Fetch all entries to count carts per group (remove date filter)
  const [entries, setEntries] = useState<any[]>([]);
  useEffect(() => {
    import("../firebase").then(({ db }) => {
      import("firebase/firestore").then(({ collection, onSnapshot, query }) => {
        const q = query(collection(db, "pickup_entries"));
        const unsub = onSnapshot(q, (snap) => {
          const fetched = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setEntries(fetched);
        });
      });
    });
  }, []);

  // Helper: count carts for a group
  const getCartCount = (groupId: string) =>
    entries.filter((e) => e.groupId === groupId).length;

  // Track input and completion state for each group
  const [segregatedCounts, setSegregatedCounts] = useState<{
    [groupId: string]: string;
  }>({});
  const [completingGroup, setCompletingGroup] = useState<string | null>(null);

  // Track manual order for segregation groups, persist in Firestore
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [orderLoading, setOrderLoading] = useState(true);

  // Today's date string for Firestore doc
  const todayStr = new Date().toISOString().slice(0, 10);
  const orderDocRef = doc(db, "segregation_orders", todayStr);

  // Load order from Firestore and listen for changes
  useEffect(() => {
    setOrderLoading(true);
    const unsub = onSnapshot(orderDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.order)) {
          setGroupOrder(data.order);
        } else {
          setGroupOrder([]);
        }
      } else {
        setGroupOrder([]);
      }
      setOrderLoading(false);
    });
    return () => unsub();
  }, [todayStr]);

  // When segregationGroups changes, initialize order in Firestore if needed
  useEffect(() => {
    if (
      !orderLoading &&
      segregationGroups.length > 0 &&
      groupOrder.length === 0
    ) {
      const initialOrder = segregationGroups.map((g) => g.id);
      setDoc(orderDocRef, { order: initialOrder }, { merge: true });
    }
    // Remove ids that are no longer present
    if (!orderLoading && groupOrder.length > 0) {
      const filtered = groupOrder.filter((id) =>
        segregationGroups.some((g) => g.id === id)
      );
      if (filtered.length !== groupOrder.length) {
        setDoc(orderDocRef, { order: filtered }, { merge: true });
      }
    }
  }, [segregationGroups, groupOrder, orderLoading]);

  // Move group up/down in the order and persist to Firestore, then update all screens immediately
  const moveGroup = (groupId: string, direction: -1 | 1) => {
    setGroupOrder((prev) => {
      const idx = prev.indexOf(groupId);
      if (idx < 0) return prev;
      const newOrder = [...prev];
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= newOrder.length) return prev;
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      // Save to Firestore and trigger real-time update for all screens
      setDoc(orderDocRef, { order: newOrder }, { merge: true });
      return newOrder;
    });
  };

  // Listen for order changes in Firestore and update local state immediately
  useEffect(() => {
    setOrderLoading(true);
    const unsub = onSnapshot(orderDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.order)) {
          setGroupOrder(data.order);
        } else {
          setGroupOrder([]);
        }
      } else {
        setGroupOrder([]);
      }
      setOrderLoading(false);
    });
    return () => unsub();
  }, [todayStr]);

  // Handler for input change
  const handleInputChange = (groupId: string, value: string) => {
    if (/^\d*$/.test(value)) {
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: value }));
    }
  };

  const orderedGroups = groupOrder
    .map((id) => segregationGroups.find((g) => g.id === id))
    .filter(Boolean);
  // If order is not loaded yet, fallback to default order
  const displayGroups =
    orderLoading || orderedGroups.length === 0
      ? segregationGroups
      : orderedGroups;

  // --- Pending Conventional Products Widget ---
  const [pendingConventionalGroups, setPendingConventionalGroups] = useState<
    any[]
  >([]);
  useEffect(() => {
    // Listen for all pickup_groups with pendingProduct === true, washingType 'Conventional', not deleted or 'Boleta Impresa', and at least one product in carts
    import("../firebase").then(({ db }) => {
      import("firebase/firestore").then(
        ({ collection, onSnapshot, query, where }) => {
          const q = query(
            collection(db, "pickup_groups"),
            where("pendingProduct", "==", true),
            where("washingType", "==", "Conventional")
          );
          const unsub = onSnapshot(q, (snap) => {
            const filtered = snap.docs
              .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
              .filter(
                (g: any) =>
                  g.pendingProduct === true &&
                  g.washingType === "Conventional" &&
                  g.status !== "deleted" &&
                  g.status !== "Boleta Impresa" &&
                  Array.isArray(g.carts) &&
                  g.carts.length > 0
              );
            setPendingConventionalGroups(filtered);
          });
          return unsub;
        }
      );
    });
  }, []);

  // Handler for completing segregation for a group
  const handleComplete = async (groupId: string) => {
    setCompletingGroup(groupId);
    try {
      // You may want to update the group status in Firestore
      await updatePickupGroupStatus(groupId, "Segregation Complete");
      setStatusUpdating(groupId); // Trigger reload
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: "" }));
      if (onGroupComplete) onGroupComplete();
    } catch (err) {
      alert("Error completing segregation for this group");
    } finally {
      setCompletingGroup(null);
    }
  };

  // --- UI ---
  return (
    <div className="container py-4">
      {/* Pending Conventional Products Widget */}
      {pendingConventionalGroups.length > 0 && (
        <div
          className="card shadow p-3 mb-4 mx-auto"
          style={{
            maxWidth: 900,
            background: "#fffbe6",
            border: "2px solid #ffc107",
          }}
        >
          <h5
            className="mb-3 text-center"
            style={{ color: "#b8860b", letterSpacing: 1 }}
          >
            Pending Conventional Products (added via + button)
          </h5>
          <div className="d-flex flex-wrap gap-3 justify-content-center">
            {pendingConventionalGroups.map((group) => (
              <div
                key={group.id}
                className="p-3 rounded shadow-sm bg-white border"
                style={{ minWidth: 180, maxWidth: 260 }}
              >
                <div
                  style={{ fontWeight: 700, color: "#007bff", fontSize: 18 }}
                >
                  {group.clientName}
                </div>
                <div style={{ fontSize: 14, color: "#333" }}>
                  Weight:{" "}
                  <strong>
                    {typeof group.totalWeight === "number"
                      ? group.totalWeight.toFixed(2)
                      : "?"}
                  </strong>{" "}
                  lbs
                </div>
                <div style={{ fontSize: 14, color: "#333" }}>
                  Carros:{" "}
                  <strong>
                    {Array.isArray(group.carts) ? group.carts.length : 0}
                  </strong>
                </div>
                <div className="mt-2">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Products:</div>
                  <ul
                    className="mb-0"
                    style={{ fontSize: 13, paddingLeft: 18 }}
                  >
                    {Array.isArray(group.carts) &&
                      group.carts.map((cart: any, idx: number) => (
                        <li key={idx}>
                          {cart.productName || cart.productId || "Product"} x
                          {cart.quantity || 1}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <h2 className="mb-4 text-center">Segregation</h2>
      {loading || orderLoading ? (
        <div className="text-center py-5">Loading...</div>
      ) : segregationGroups.length === 0 ? (
        <div className="text-muted text-center py-5">
          No groups for segregation today.
        </div>
      ) : (
        <div className="card shadow p-4 mb-4 mx-auto" style={{ maxWidth: '100%', overflowX: 'visible' }}>
          <h5 className="mb-4 text-center" style={{ letterSpacing: 1 }}>
            Groups for Segregation
          </h5>
          {/* First group: full card with controls */}
          {displayGroups[0] && (
            <div
              key={displayGroups[0].id}
              className="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded border border-3 border-primary bg-info-subtle"
              style={{ background: "#eaf2fb", border: "3px solid #007bff" }}
            >
              <div className="row w-100 g-2 align-items-center flex-nowrap flex-md-wrap">
                <div
                  className="col-12 col-md-auto d-flex align-items-center mb-2 mb-md-0"
                  style={{ minWidth: 160 }}
                >
                  <span
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      color: "#007bff",
                      wordBreak: "break-word",
                    }}
                  >
                    {displayGroups[0].clientName}
                  </span>
                </div>
                <div
                  className="col-6 col-md-auto text-md-center mb-2 mb-md-0"
                  style={{ minWidth: 120 }}
                >
                  <span style={{ fontSize: "1.1rem", color: "#333" }}>
                    Weight:{" "}
                    <strong>
                      {typeof displayGroups[0].totalWeight === "number"
                        ? displayGroups[0].totalWeight.toFixed(2)
                        : "?"}
                    </strong>{" "}
                    lbs
                  </span>
                </div>
                <div
                  className="col-6 col-md-auto text-md-center mb-2 mb-md-0"
                  style={{ minWidth: 120 }}
                >
                  <span style={{ fontSize: "1.1rem", color: "#333" }}>
                    Carros: <strong>{getCartCount(displayGroups[0].id)}</strong>
                  </span>
                </div>
                <div
                  className="col-12 col-md-auto d-flex flex-row gap-1 align-items-center justify-content-md-end ms-auto mb-2 mb-md-0"
                  style={{ minWidth: 120 }}
                >
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    title="Move up"
                    disabled={true}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    title="Move down"
                    disabled={displayGroups.length === 1}
                    onClick={() => moveGroup(displayGroups[0].id, 1)}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                  <button
                    className="btn btn-outline-info btn-sm ms-2"
                    onClick={() => {
                      setLogGroup(displayGroups[0]);
                      setShowLogModal(true);
                    }}
                    title="View Group Log"
                  >
                    Log
                  </button>
                </div>
              </div>
              <div className="d-flex flex-column flex-md-row gap-3 align-items-center mt-3 mt-md-0 w-100">
                <div className="d-flex flex-row gap-2 align-items-center justify-content-center flex-wrap w-100">
                  <button
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() =>
                      handleInputChange(
                        displayGroups[0].id,
                        String(
                          Math.max(
                            0,
                            parseInt(
                              segregatedCounts[displayGroups[0].id] || "0",
                              10
                            ) - 1
                          )
                        )
                      )
                    }
                    disabled={completingGroup === displayGroups[0].id}
                    style={{ minWidth: 48 }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    className="form-control form-control-lg text-center"
                    style={{
                      width: 100,
                      fontSize: 24,
                      fontWeight: 700,
                      maxWidth: "100%",
                    }}
                    placeholder="# segregated"
                    value={segregatedCounts[displayGroups[0].id] || ""}
                    onChange={(e) =>
                      handleInputChange(displayGroups[0].id, e.target.value)
                    }
                    disabled={completingGroup === displayGroups[0].id}
                  />
                  <button
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() =>
                      handleInputChange(
                        displayGroups[0].id,
                        String(
                          parseInt(
                            segregatedCounts[displayGroups[0].id] || "0",
                            10
                          ) + 1
                        )
                      )
                    }
                    disabled={completingGroup === displayGroups[0].id}
                    style={{ minWidth: 48 }}
                  >
                    +
                  </button>
                  <button
                    className="btn btn-success btn-lg ms-3"
                    disabled={
                      completingGroup === displayGroups[0].id ||
                      !segregatedCounts[displayGroups[0].id]
                    }
                    onClick={() => handleComplete(displayGroups[0].id)}
                    style={{ fontWeight: 700, fontSize: 20, minWidth: 120 }}
                  >
                    {completingGroup === displayGroups[0].id
                      ? "Saving..."
                      : "Completed"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* All other groups: summarized in a single responsive row */}
          {displayGroups.length > 1 && (
            <div className="d-block mt-3">
              <div
                className="d-flex flex-wrap flex-md-nowrap gap-2 justify-content-center align-items-center w-100"
                style={{ overflowX: "auto" }}
              >
                {displayGroups.slice(1).map((group, idx) => (
                  <div
                    key={group.id}
                    className="px-3 py-2 rounded shadow-sm bg-white border d-flex flex-column align-items-center"
                    style={{
                      minWidth: 140,
                      maxWidth: 180,
                      marginBottom: 8,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#007bff",
                        fontSize: 16,
                        textAlign: "center",
                        wordBreak: "break-word",
                      }}
                    >
                      {group.clientName}
                    </span>
                    <div className="d-flex flex-row gap-3" style={{ fontSize: '0.95rem', color: '#333', minWidth: 0, maxWidth: '100%' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Weight: <strong>{typeof group.totalWeight === 'number' ? group.totalWeight.toFixed(2) : '?'}</strong> lbs
                      </span>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Carros: <strong>{getCartCount(group.id)}</strong>
                      </span>
                    </div>
                    <div className="d-flex flex-row gap-1 align-items-center mt-2">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        title="Move up"
                        disabled={idx === 0 && displayGroups.length === 2}
                        onClick={() => moveGroup(group.id, -1)}
                      >
                        <span aria-hidden="true">▲</span>
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        title="Move down"
                        disabled={idx === displayGroups.length - 2}
                        onClick={() => moveGroup(group.id, 1)}
                      >
                        <span aria-hidden="true">▼</span>
                      </button>
                      <button
                        className="btn btn-outline-info btn-sm"
                        onClick={() => {
                          setLogGroup(group);
                          setShowLogModal(true);
                        }}
                        title="View Group Log"
                      >
                        Log
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {showLogModal && logGroup && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Group History Log</h5>
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
                    No log history for this group.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Segregation;
