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
        <div className="card shadow p-4 mb-4 mx-auto" style={{ maxWidth: '100%', overflowX: 'visible' }}>
          <h5 className="mb-4 text-center" style={{ letterSpacing: 1 }}>
            Groups for Segregation
          </h5>
          <div className="list-group list-group-flush">
            {displayGroups.map((group, idx) => (
              <div
                key={group.id}
                className={`list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 py-3 mb-2 shadow-sm rounded${idx === 0 ? ' border border-3 border-primary bg-info-subtle' : ''}`}
                style={{
                  background: idx === 0 ? '#eaf2fb' : '#f8f9fa',
                  border: idx === 0 ? '3px solid #007bff' : '1px solid #e3e3e3',
                  flexWrap: 'wrap',
                  minWidth: 0,
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                  overflowX: 'visible',
                }}
              >
                <div className="d-flex flex-row justify-content-between align-items-center w-100" style={{ minWidth: 0, maxWidth: '100%' }}>
                  {/* Left: Client info */}
                  <div className="d-flex flex-column" style={{ minWidth: 0, maxWidth: '60%' }}>
                    <span
                      style={{
                        fontSize: idx === 0 ? '1.1rem' : '1rem',
                        fontWeight: idx === 0 ? 700 : 600,
                        color: '#007bff',
                        minWidth: 0,
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 2,
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
                  </div>
                  {/* Right: Controls */}
                  <div className="d-flex flex-row align-items-center gap-2 justify-content-end" style={{ minWidth: 0, maxWidth: '40%', flexWrap: 'nowrap' }}>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() => moveGroup(group.id, -1)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <span aria-hidden="true">▲</span>
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      title="Move down"
                      disabled={idx === displayGroups.length - 1}
                      onClick={() => moveGroup(group.id, 1)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <span aria-hidden="true">▼</span>
                    </button>
                    {idx === 0 && (
                      <>
                        <button
                          className="btn btn-outline-secondary btn-sm ms-2"
                          onClick={() =>
                            handleInputChange(
                              group.id,
                              String(
                                Math.max(
                                  0,
                                  parseInt(segregatedCounts[group.id] || '0', 10) - 1
                                )
                              )
                            )
                          }
                          disabled={completingGroup === group.id}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          className="form-control form-control-sm text-center"
                          style={{ width: 60, fontSize: 16, fontWeight: 600, minWidth: 0, maxWidth: '100%' }}
                          placeholder="# segregated"
                          value={segregatedCounts[group.id] || ''}
                          onChange={(e) => handleInputChange(group.id, e.target.value)}
                          disabled={completingGroup === group.id}
                        />
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() =>
                            handleInputChange(
                              group.id,
                              String(
                                parseInt(segregatedCounts[group.id] || '0', 10) + 1
                              )
                            )
                          }
                          disabled={completingGroup === group.id}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          +
                        </button>
                        <button
                          className="btn btn-success btn-sm ms-2"
                          disabled={
                            completingGroup === group.id ||
                            !segregatedCounts[group.id]
                          }
                          onClick={() => handleComplete(group.id)}
                          style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}
                        >
                          {completingGroup === group.id ? 'Saving...' : 'Completed'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Segregation;
