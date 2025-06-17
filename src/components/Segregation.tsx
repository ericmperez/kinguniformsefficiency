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

  // Move group up/down in the order and persist to Firestore
  const moveGroup = (groupId: string, direction: -1 | 1) => {
    setGroupOrder((prev) => {
      const idx = prev.indexOf(groupId);
      if (idx < 0) return prev;
      const newOrder = [...prev];
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= newOrder.length) return prev;
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      setDoc(orderDocRef, { order: newOrder }, { merge: true });
      return newOrder;
    });
  };

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
        <>
          {/* Current Segregating Client Card */}
          {displayGroups[0] && (
            <div className="card shadow-lg p-5 mb-5 mx-auto" style={{ maxWidth: 700, background: '#eaf2fb', border: '3px solid #007bff' }}>
              <h4 className="mb-4 text-center" style={{ letterSpacing: 1, fontWeight: 700 }}>
                Current Segregating Client:
              </h4>
              <div className="d-flex flex-column flex-md-row align-items-md-center gap-4 justify-content-between">
                <div className="flex-grow-1">
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#007bff' }}>{displayGroups[0].clientName}</div>
                  <div style={{ fontSize: '1.2rem', color: '#333' }}>
                    Carros: <strong>{getCartCount(displayGroups[0].id)}</strong>
                  </div>
                </div>
                <div className="d-flex flex-row gap-3 align-items-center mt-3 mt-md-0">
                  <button
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() => handleInputChange(displayGroups[0].id, String(Math.max(0, (parseInt(segregatedCounts[displayGroups[0].id] || '0', 10) - 1)) ))}
                    disabled={completingGroup === displayGroups[0].id}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    className="form-control form-control-lg text-center"
                    style={{ width: 100, fontSize: 24, fontWeight: 700 }}
                    placeholder="# segregated"
                    value={segregatedCounts[displayGroups[0].id] || ""}
                    onChange={e => handleInputChange(displayGroups[0].id, e.target.value)}
                    disabled={completingGroup === displayGroups[0].id}
                  />
                  <button
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() => handleInputChange(displayGroups[0].id, String((parseInt(segregatedCounts[displayGroups[0].id] || '0', 10) + 1) ))}
                    disabled={completingGroup === displayGroups[0].id}
                  >
                    +
                  </button>
                  <button
                    className="btn btn-success btn-lg ms-3"
                    disabled={completingGroup === displayGroups[0].id || !segregatedCounts[displayGroups[0].id]}
                    onClick={() => handleComplete(displayGroups[0].id)}
                    style={{ fontWeight: 700, fontSize: 20 }}
                  >
                    {completingGroup === displayGroups[0].id ? "Saving..." : "Verify"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Other Groups */}
          <div className="card shadow p-4 mb-4 mx-auto" style={{ maxWidth: 900 }}>
            <h5 className="mb-4 text-center" style={{ letterSpacing: 1 }}>
              Groups for Segregation
            </h5>
            <div className="list-group list-group-flush">
              {displayGroups.slice(1).map((group, idx) => (
                <div
                  key={group.id}
                  className="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded"
                  style={{ background: "#f8f9fa", border: "1px solid #e3e3e3" }}
                >
                  <div className="d-flex flex-column flex-md-row align-items-md-center gap-3 flex-grow-1">
                    <span style={{ fontSize: "1.2rem", fontWeight: 600, color: "#007bff" }}>{group.clientName}</span>
                    <span style={{ fontSize: "1.1rem", color: "#333" }}>
                      Carros: <strong>{getCartCount(group.id)}</strong>
                    </span>
                  </div>
                  <div className="d-flex flex-row gap-2 align-items-center">
                    <input
                      type="number"
                      min={0}
                      className="form-control form-control-sm"
                      style={{ width: 110, maxWidth: "100%" }}
                      placeholder="# segregated"
                      value={segregatedCounts[group.id] || ""}
                      onChange={e => handleInputChange(group.id, e.target.value)}
                      disabled={completingGroup === group.id}
                    />
                    <button
                      className="btn btn-success btn-sm px-4"
                      disabled={completingGroup === group.id || !segregatedCounts[group.id]}
                      onClick={() => handleComplete(group.id)}
                      style={{ fontWeight: 500, fontSize: 15 }}
                    >
                      {completingGroup === group.id ? "Saving..." : "Complete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Segregation;
