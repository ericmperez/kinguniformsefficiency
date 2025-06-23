import React, { useEffect, useState } from "react";
import {
  getTodayPickupGroups,
  updatePickupGroupStatus,
  getClients,
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
  const [movingGroupId, setMovingGroupId] = useState<string | null>(null);

  // Remove setGroupOrder from moveGroup, only update Firestore
  const moveGroup = async (groupId: string, direction: -1 | 1) => {
    // Always use the latest groupOrder from state
    const idx = groupOrder.indexOf(groupId);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= groupOrder.length) return;
    const newOrder = [...groupOrder];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await setDoc(orderDocRef, { order: newOrder }, { merge: true });
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
        <div
          className="mb-4 mx-auto"
          style={{ maxWidth: "100%", overflowX: "visible" }}
        >
          <h5 className="mb-4 text-center" style={{ letterSpacing: 1 }}>
            Groups for Segregation
          </h5>
          <div className="d-flex flex-column w-100">
            {displayGroups.map((group, idx) => (
              <div
                key={group.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  minHeight: 64,
                  borderBottom: "1.5px solid #e0e0e0",
                  padding: "0.5rem 0",
                  background: idx % 2 === 0 ? "#fff" : "#f7f7f7",
                  fontSize: 18,
                }}
              >
                <div
                  style={{
                    flex: 2,
                    fontWeight: 700,
                    color: "#007bff",
                    fontSize: 22,
                    wordBreak: "break-word",
                  }}
                >
                  {group.clientName}
                </div>
                <div style={{ flex: 1, textAlign: "center", color: "#333" }}>
                  Weight:{" "}
                  <strong>
                    {typeof group.totalWeight === "number"
                      ? group.totalWeight.toFixed(2)
                      : "?"}
                  </strong>{" "}
                  lbs
                </div>
                <div style={{ flex: 1, textAlign: "center", color: "#333" }}>
                  Carros: <strong>{getCartCount(group.id)}</strong>
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    title="Move up"
                    disabled={idx === 0}
                    onClick={() => moveGroup(group.id, -1)}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    title="Move down"
                    disabled={idx === displayGroups.length - 1}
                    onClick={() => moveGroup(group.id, 1)}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                </div>
                <div
                  style={{
                    flex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <button
                    className="btn btn-outline-secondary btn-lg"
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
                    style={{ minWidth: 40 }}
                  >
                    -
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
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() =>
                      handleInputChange(
                        group.id,
                        String(
                          parseInt(segregatedCounts[group.id] || "0", 10) + 1
                        )
                      )
                    }
                    disabled={completingGroup === group.id}
                    style={{ minWidth: 40 }}
                  >
                    +
                  </button>
                  <button
                    className="btn btn-success btn-lg ms-2"
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
