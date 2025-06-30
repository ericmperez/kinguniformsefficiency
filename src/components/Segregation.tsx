import React, { useEffect, useState } from "react";
import {
  getTodayPickupGroups,
  updatePickupGroupStatus,
  getClients,
  logActivity,
} from "../services/firebaseService";
import type { Client } from "../types";
// Add Firestore imports
import {
  doc,
  updateDoc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Segregation.css";

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

  // Fetch clients only once on mount
  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      const fetchedClients = await getClients();
      setClients(fetchedClients);
      setLoading(false);
    };
    fetchClients();
  }, []);

  // Real-time listener for all pickup_groups (no date filter)
  useEffect(() => {
    const q = collection(db, "pickup_groups");
    const unsub = onSnapshot(q, (snap) => {
      const fetchedGroups = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(fetchedGroups);
    });
    return () => unsub();
  }, []);

  // Show all groups with status 'Segregacion' or 'Segregation' (case-insensitive)
  const segregationGroups = groups.filter(
    (g) =>
      typeof g.status === "string" &&
      ["segregacion", "segregation"].includes(g.status.toLowerCase())
  );

  // Only set group status to 'Segregation' if it is in a pre-segregation state (e.g., 'Pickup Complete')
  useEffect(() => {
    if (!loading && groups.length > 0 && clients.length > 0) {
      groups.forEach((group) => {
        const client = clients.find((c) => c.id === group.clientId);
        // Only set to 'Segregation' if client needs segregation and group is in a pre-segregation state
        if (client && client.segregation && group.status === undefined) {
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
        // Return unsubscribe function for cleanup
        return unsub;
      });
    });
  }, []);

  // Helper: count carts for a group
  const getCartCount = (groupId: string) =>
    entries.filter((e) => e.groupId === groupId).length;

  // Helper: get expected verification value for a group
  const getExpectedVerificationValue = (
    group: any,
    client: Client | undefined
  ) => {
    // For Tunnel clients that do NOT need segregation, use the number of carts as verification
    if (
      client &&
      client.washingType === "Tunnel" &&
      client.segregation === false
    ) {
      return getCartCount(group.id);
    }
    // For other clients, use segregatedCarts (default behavior)
    return group.segregatedCarts;
  };

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
  const [movingGroupId, setMovingGroupId] = useState<string | null>(null);

  // Optimistically update local groupOrder before persisting to Firestore
  const moveGroup = async (groupId: string, direction: -1 | 1) => {
    let idx = groupOrder.indexOf(groupId);
    let newOrder = [...groupOrder];
    // If group is not in order, append it
    if (idx === -1) {
      newOrder.push(groupId);
      idx = newOrder.length - 1;
    }
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setGroupOrder(newOrder); // Optimistic UI update
    await setDoc(orderDocRef, { order: newOrder }, { merge: true });
    await logActivity({
      type: "Segregation",
      message: `Group ${groupId} moved ${
        direction === -1 ? "up" : "down"
      } by user`,
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

  // Handler to delete a segregation group
  const handleDeleteSegregationGroup = async (groupId: string) => {
    if (
      !window.confirm(
        "Delete this group and all its data? This action cannot be undone."
      )
    )
      return;
    // Optimistically update UI
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try {
      await updateDoc(doc(db, "pickup_groups", groupId), { status: "deleted" });
    } catch (e) {
      // Optionally show error and revert UI if needed
      // For now, do nothing (UI will sync with Firestore on next snapshot)
    }
  };

  // Helper to get current user (from localStorage or context)
  const getCurrentUser = () => {
    try {
      const user = JSON.parse(localStorage.getItem("ku_user") || "null");
      return user?.username || user?.id || "Unknown";
    } catch {
      return "Unknown";
    }
  };

  // Handler for input change
  const handleInputChange = (groupId: string, value: string) => {
    if (/^\d*$/.test(value)) {
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: value }));
    }
  };

  // In the + button handler:
  const handleIncrement = async (groupId: string) => {
    const newValue = String(parseInt(segregatedCounts[groupId] || "0", 10) + 1);
    setSegregatedCounts((prev) => ({ ...prev, [groupId]: newValue }));
    const group = groups.find((g) => g.id === groupId);
    // Persist the new value to Firestore
    await updateDoc(doc(db, "pickup_groups", groupId), {
      segregatedCarts: parseInt(newValue, 10),
      updatedAt: new Date().toISOString(),
    });
    await logActivity({
      type: "Segregation",
      message: `+1 to group ${
        group?.clientName || groupId
      } (${groupId}) by user`,
    });
  };

  // In the - button handler:
  const handleDecrement = async (groupId: string) => {
    const newValue = String(
      Math.max(0, parseInt(segregatedCounts[groupId] || "0", 10) - 1)
    );
    setSegregatedCounts((prev) => ({ ...prev, [groupId]: newValue }));
    const group = groups.find((g) => g.id === groupId);
    // Persist the new value to Firestore
    await updateDoc(doc(db, "pickup_groups", groupId), {
      segregatedCarts: parseInt(newValue, 10),
      updatedAt: new Date().toISOString(),
    });
    await logActivity({
      type: "Segregation",
      message: `-1 to group ${
        group?.clientName || groupId
      } (${groupId}) by user`,
    });
  };

  // Always use groupOrder to render, but append any new segregationGroups not in groupOrder
  const displayGroups = [
    ...groupOrder
      .map((id) => segregationGroups.find((g) => g.id === id))
      .filter(Boolean),
    ...segregationGroups.filter((g) => !groupOrder.includes(g.id)),
  ];

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
      const group = groups.find((g) => g.id === groupId);
      const client = clients.find((c) => c.id === group?.clientId);
      const segregatedCount = parseInt(segregatedCounts[groupId] || "0", 10);
      // Always set status to Tunnel or Conventional only
      let newStatus = "Conventional";
      if (client?.washingType === "Tunnel") newStatus = "Tunnel";
      await updateDoc(doc(db, "pickup_groups", groupId), {
        segregatedCarts: segregatedCount,
        status: newStatus,
      });
      setStatusUpdating(groupId);
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: "" }));
      if (onGroupComplete) onGroupComplete();
      await logActivity({
        type: "Segregation",
        message: `Group ${
          group?.clientName || groupId
        } completed segregation by user`,
      });
    } catch (err) {
      alert("Error completing segregation for this group");
    } finally {
      setCompletingGroup(null);
    }
  };

  // Real-time listener for all pickup_groups (no date filter)
  useEffect(() => {
    const q = collection(db, "pickup_groups");
    const unsub = onSnapshot(q, (snap) => {
      const fetchedGroups = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(fetchedGroups);
    });
    return () => unsub();
  }, []);

  // Sync segregatedCounts with Firestore values in real time
  useEffect(() => {
    // Only update segregatedCounts if the Firestore value is different from the current input
    setSegregatedCounts((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (
          typeof group.segregatedCarts === "number" &&
          (prev[group.id] === undefined ||
            prev[group.id] !== String(group.segregatedCarts))
        ) {
          next[group.id] = String(group.segregatedCarts);
        }
      });
      // Remove counts for groups that no longer exist
      Object.keys(next).forEach((id) => {
        if (!groups.some((g) => g.id === id)) delete next[id];
      });
      return next;
    });
  }, [groups]);

  // --- UI ---
  // Highlight the top group (first in displayGroups) in a big bold box at the top
  const topGroup = displayGroups[0];

  return (
    <div className="container py-4">
      {/* Top group highlight */}
      {topGroup && (
        <div
          className="mb-4 p-4 shadow-lg rounded border border-3 border-primary bg-white text-center"
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#007bff",
            letterSpacing: 1,
          }}
        >
          {topGroup.clientName}
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#333",
              marginTop: 8,
            }}
          >
            Libras:{" "}
            <strong>
              {typeof topGroup.totalWeight === "number"
                ? topGroup.totalWeight.toFixed(2)
                : "?"}{" "}
              lbs
            </strong>{" "}
            &nbsp; | &nbsp; Carros: <strong>{getCartCount(topGroup.id)}</strong>
          </div>
        </div>
      )}
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
      {/* Modernized group rows, no section titles */}
      {loading || orderLoading ? (
        <div className="text-center py-5">Loading...</div>
      ) : segregationGroups.length === 0 ? (
        <div className="text-muted text-center py-5">
          No groups for segregation today.
        </div>
      ) : (
        <div
          className="mb-4 mx-auto"
          style={{ maxWidth: "100%", overflowX: "visible" }}
        >
          <div className="d-flex flex-column w-100 gap-3">
            {displayGroups.map((group, idx) => (
              <div
                key={group.id}
                className="shadow-sm rounded bg-white d-flex align-items-center px-4 py-3 mb-3 flex-wrap flex-md-nowrap seg-row"
                style={{
                  border: "1.5px solid #e0e0e0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  fontSize: 18,
                  transition: "box-shadow 0.2s",
                  minHeight: 72,
                }}
              >
                <div
                  style={{
                    flex: "2 1 180px",
                    fontWeight: 700,
                    color: "#007bff",
                    fontSize: 22,
                    wordBreak: "break-word",
                    minWidth: 120,
                  }}
                  className="mb-2 mb-md-0"
                >
                  {group.clientName}
                </div>
                <div
                  style={{
                    flex: "1 1 120px",
                    textAlign: "center",
                    color: "#333",
                    fontSize: 17,
                    minWidth: 90,
                  }}
                  className="mb-2 mb-md-0"
                >
                  Libras:{" "}
                  <strong>
                    {typeof group.totalWeight === "number"
                      ? group.totalWeight.toFixed(2)
                      : "?"}
                  </strong>
                </div>
                <div
                  style={{
                    flex: "1 1 120px",
                    textAlign: "center",
                    color: "#333",
                    fontSize: 17,
                    minWidth: 90,
                  }}
                  className="mb-2 mb-md-0"
                >
                  Carros: <strong>{getCartCount(group.id)}</strong>
                </div>
                <div
                  style={{
                    flex: "0 0 48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 48,
                  }}
                  className="mb-2 mb-md-0"
                >
                  <button
                    className="btn btn-outline-danger btn-sm rounded-circle"
                    title="Delete group"
                    onClick={() => handleDeleteSegregationGroup(group.id)}
                    style={{ width: 36, height: 36, fontSize: 18 }}
                  >
                    <span aria-hidden="true">🗑️</span>
                  </button>
                </div>
                <div
                  style={{
                    flex: "1 1 100px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16, // More gap to ensure no overlap with other buttons
                    minWidth: 90,
                  }}
                  className="mb-2 mb-md-0 segregation-arrows-col"
                >
                  <button
                    className="btn btn-outline-secondary btn-sm rounded-circle segregation-arrow-btn"
                    title="Move up"
                    disabled={idx === 0}
                    onClick={() => moveGroup(group.id, -1)}
                    style={{
                      width: 36,
                      height: 36,
                      fontSize: 18,
                      marginRight: 2,
                    }}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm rounded-circle segregation-arrow-btn"
                    title="Move down"
                    disabled={idx === displayGroups.length - 1}
                    onClick={() => moveGroup(group.id, 1)}
                    style={{
                      width: 36,
                      height: 36,
                      fontSize: 18,
                      marginLeft: 2,
                    }}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                </div>
                <div
                  style={{
                    flex: "2 1 220px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                    minWidth: 180,
                  }}
                  className="mt-2 mt-md-0"
                >
                  <button
                    className="btn btn-outline-secondary btn-lg d-flex align-items-center justify-content-center"
                    onClick={() =>
                      handleInputChange(
                        group.id,
                        String(
                          Math.max(
                            0,
                            parseInt(segregatedCounts[group.id] || "0", 10) - 1
                          )
                        )
                      )
                    }
                    disabled={completingGroup === group.id}
                    style={{
                      minWidth: 40,
                      width: 40,
                      height: 40,
                      fontSize: 22,
                      borderRadius: 6,
                      aspectRatio: "1 / 1",
                      padding: 0,
                    }}
                  >
                    <span
                      style={{ fontWeight: 700, fontSize: 28, lineHeight: 1 }}
                    >
                      -
                    </span>
                  </button>
                  <input
                    type="number"
                    min={0}
                    className="form-control form-control-lg text-center"
                    style={{
                      width: 80,
                      fontSize: 20,
                      fontWeight: 700,
                      maxWidth: "100%",
                    }}
                    placeholder="# segregated"
                    value={segregatedCounts[group.id] || ""}
                    onChange={(e) =>
                      handleInputChange(group.id, e.target.value)
                    }
                    disabled={completingGroup === group.id}
                  />
                  <button
                    className="btn btn-outline-secondary btn-lg d-flex align-items-center justify-content-center"
                    onClick={() =>
                      handleInputChange(
                        group.id,
                        String(
                          parseInt(segregatedCounts[group.id] || "0", 10) + 1
                        )
                      )
                    }
                    disabled={completingGroup === group.id}
                    style={{
                      minWidth: 40,
                      width: 40,
                      height: 40,
                      fontSize: 22,
                      borderRadius: 6,
                      aspectRatio: "1 / 1",
                      padding: 0,
                    }}
                  >
                    <span
                      style={{ fontWeight: 700, fontSize: 28, lineHeight: 1 }}
                    >
                      +
                    </span>
                  </button>
                  <button
                    className="btn btn-success btn-lg ms-2 px-4"
                    disabled={
                      completingGroup === group.id ||
                      !segregatedCounts[group.id]
                    }
                    onClick={() => handleComplete(group.id)}
                    style={{ fontWeight: 700, fontSize: 18, minWidth: 100 }}
                  >
                    {completingGroup === group.id ? "Saving..." : "Completed"}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                {/* TODO: Implement group log details here, or remove this modal if not needed */}
                <div className="text-muted">No log data available.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Segregation;
