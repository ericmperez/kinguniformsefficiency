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

  useEffect(() => {
    setLoading(true);
    // Get today's date range in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    // Firestore query for today's pickup_groups
    import("../firebase").then(({ db }) => {
      import("firebase/firestore").then(
        ({ collection, onSnapshot, query, where, Timestamp }) => {
          const q = query(
            collection(db, "pickup_groups"),
            where("startTime", ">=", Timestamp.fromDate(today)),
            where("startTime", "<", Timestamp.fromDate(tomorrow))
          );
          const unsub = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setGroups(fetched);
            setLoading(false);
          });
        }
      );
    });
    // No cleanup needed because this is a one-day query and component unmount will clear listeners
  }, [statusUpdating]);

  // Show only groups with status 'Segregation' and not 'Entregado' or 'deleted'
  const segregationGroups = groups.filter(
    (g) => g.status === "Segregation" && g.status !== "Entregado" && g.status !== "deleted"
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

  // Fetch all entries for today to count carts per group
  const [entries, setEntries] = useState<any[]>([]);
  useEffect(() => {
    // Get today's date range in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    // Firestore query for today's pickup_entries
    import("../firebase").then(({ db }) => {
      import("firebase/firestore").then(
        ({ collection, onSnapshot, query, where, Timestamp }) => {
          const q = query(
            collection(db, "pickup_entries"),
            where("timestamp", ">=", Timestamp.fromDate(today)),
            where("timestamp", "<", Timestamp.fromDate(tomorrow))
          );
          const unsub = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setEntries(fetched);
          });
        }
      );
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

  // Handler for complete button
  const handleComplete = async (groupId: string) => {
    setCompletingGroup(groupId);
    const count = parseInt(segregatedCounts[groupId] || "");
    if (isNaN(count) || count < 0) {
      alert("Please enter a valid number of segregated carts.");
      setCompletingGroup(null);
      return;
    }
    const group = groups.find((g) => g.id === groupId);
    const client = clients.find((c) => c.id === group?.clientId);
    let nextStatus = "Tunnel";
    if (client?.washingType === "Conventional") nextStatus = "Conventional";
    await updatePickupGroupStatus(groupId, nextStatus);
    const groupRef = doc(db, "pickup_groups", groupId);
    await updateDoc(groupRef, { segregatedCarts: count });
    setCompletingGroup(null);
    setSegregatedCounts((prev) => ({ ...prev, [groupId]: "" }));
    if (onGroupComplete) onGroupComplete();
    // setGroups(prev => prev.filter(g => g.id !== groupId)); // Remove only after Firestore update
  };

  // Render groups in custom order
  const orderedGroups = groupOrder
    .map((id) => segregationGroups.find((g) => g.id === id))
    .filter(Boolean);
  // If order is not loaded yet, fallback to default order
  const displayGroups =
    orderLoading || orderedGroups.length === 0
      ? segregationGroups
      : orderedGroups;

  // --- UI ---
  return (
    <div className="container py-4">
      <h2 className="mb-4 text-center">Segregation</h2>
      {loading || orderLoading ? (
        <div className="text-center py-5">Loading...</div>
      ) : segregationGroups.length === 0 ? (
        <div className="text-muted text-center py-5">
          No groups for segregation today.
        </div>
      ) : (
        <div className="card shadow p-4 mb-4 mx-auto" style={{ maxWidth: 900 }}>
          <h5 className="mb-4 text-center" style={{ letterSpacing: 1 }}>
            Groups for Segregation
          </h5>
          <div className="list-group list-group-flush">
            {displayGroups.map((group, idx) => (
              <div
                key={group.id}
                className={`list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded${
                  idx === 0
                    ? " border border-3 border-primary bg-info-subtle"
                    : ""
                }`}
                style={{
                  background: idx === 0 ? "#eaf2fb" : "#f8f9fa",
                  border:
                    idx === 0 ? "3px solid #007bff" : "1px solid #e3e3e3",
                }}
              >
                <div className="d-flex flex-column flex-md-row align-items-md-center gap-3 flex-grow-1">
                  <span
                    style={{
                      fontSize: idx === 0 ? "2rem" : "1.2rem",
                      fontWeight: idx === 0 ? 800 : 600,
                      color: "#007bff",
                    }}
                  >
                    {group.clientName}
                  </span>
                  <span style={{ fontSize: "1.1rem", color: "#333" }}>
                    Weight:{" "}
                    <strong>
                      {typeof group.totalWeight === "number"
                        ? group.totalWeight.toFixed(2)
                        : "?"}
                    </strong>{" "}
                    lbs
                  </span>
                  <span style={{ fontSize: "1.1rem", color: "#333" }}>
                    Carros: <strong>{getCartCount(group.id)}</strong>
                  </span>
                </div>
                <div className="d-flex flex-row gap-1 align-items-center ms-auto">
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
                {idx === 0 && (
                  <div className="d-flex flex-row gap-3 align-items-center mt-3 mt-md-0 ms-4">
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
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      className="form-control form-control-lg text-center"
                      style={{ width: 100, fontSize: 24, fontWeight: 700 }}
                      placeholder="# segregated"
                      value={segregatedCounts[group.id] || ""}
                      onChange={(e) => handleInputChange(group.id, e.target.value)}
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
                    >
                      +
                    </button>
                    <button
                      className="btn btn-success btn-lg ms-3"
                      disabled={
                        completingGroup === group.id ||
                        !segregatedCounts[group.id]
                      }
                      onClick={() => handleComplete(group.id)}
                      style={{ fontWeight: 700, fontSize: 20 }}
                    >
                      {completingGroup === group.id ? "Saving..." : "Completed"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Segregation;
