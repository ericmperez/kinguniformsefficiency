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
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Segregation.css";
import { useAuth } from "./AuthContext";

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
      // --- LOG TO segregation_done_logs ---
      // Calculate total weight for this group (sum all carts' totalWeight or use group.totalWeight if available)
      let totalWeight = 0;
      if (Array.isArray(group?.carts)) {
        totalWeight = group.carts.reduce((sum: number, cart: any) => sum + (cart.totalWeight || 0), 0);
      } else if (typeof group?.totalWeight === "number") {
        totalWeight = group.totalWeight;
      }
      await addDoc(collection(db, "segregation_done_logs"), {
        clientId: client?.id || group?.clientId || groupId,
        clientName: client?.name || group?.clientName || "",
        date: new Date().toISOString().slice(0, 10),
        weight: totalWeight,
        groupId,
        timestamp: new Date().toISOString(),
        user: getCurrentUser(),
      });
      // --- END LOG ---
      setStatusUpdating(groupId);
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: "" }));
      if (onGroupComplete) onGroupComplete();
      await logActivity({
        type: "Segregation",
        message: `Group ${group?.clientName || groupId} completed segregation by user`,
      });
    } catch (err) {
      alert("Error completing segregation for this group");
    } finally {
      setCompletingGroup(null);
    }
  };

  // Handler to skip segregation for a group
  const handleSkipSegregation = async (groupId: string) => {
    setCompletingGroup(groupId);
    try {
      const group = groups.find((g) => g.id === groupId);
      const client = clients.find((c) => c.id === group?.clientId);
      // Use the current cart count as the segregatedCarts value
      const cartCount = getCartCount(groupId);
      let newStatus = "Conventional";
      if (client?.washingType === "Tunnel") newStatus = "Tunnel";
      await updateDoc(doc(db, "pickup_groups", groupId), {
        segregatedCarts: cartCount,
        status: newStatus,
      });
      setStatusUpdating(groupId);
      setSegregatedCounts((prev) => ({
        ...prev,
        [groupId]: String(cartCount),
      }));
      if (onGroupComplete) onGroupComplete();
      await logActivity({
        type: "Segregation",
        message: `Group ${
          group?.clientName || groupId
        } skipped segregation by user`,
      });
    } catch (err) {
      alert("Error skipping segregation for this group");
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

  const { user } = useAuth();

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
                ? topGroup.totalWeight.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })
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
          className="card shadow p-3 mb-4 mx-auto"
          style={{
            maxWidth: 720, // was 600
            minWidth: 320, // was 260
            width: "100%",
            background: "#f8f9fa",
            border: "2px solid #0E62A0",
            borderRadius: 16,
            boxShadow: "0 4px 16px rgba(14,98,160,0.10)",
            padding: "2rem 1rem 1.5rem 1rem",
            marginBottom: 24,
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <h4
            className="mb-3 text-center"
            style={{
              letterSpacing: 1,
              fontSize: 22,
              fontWeight: 800,
              color: "#0E62A0",
            }}
          >
            Groups for Segregation
          </h4>
          <div
            className="list-group list-group-flush w-100"
            style={{ maxWidth: 640, margin: "0 auto" }} // was 520
          >
            {displayGroups.map((group, idx) => {
              const disableActions = !!group.segregationTomorrow;
              const isSupervisorOrAbove =
                user && ["Supervisor", "Admin", "Owner"].includes(user.role);
              if (group.segregationTomorrow && !isSupervisorOrAbove) {
                return (
                  <div
                    key={group.id}
                    className="list-group-item d-flex flex-column py-3 mb-2 shadow-sm rounded"
                    style={{
                      background: "#ffe066",
                      border: "2.5px solid #ffa600",
                      fontSize: 14,
                      minHeight: 56,
                      boxShadow: "0 1px 6px rgba(14,98,160,0.06)",
                      transition: "background 0.2s, border 0.2s",
                      pointerEvents: "none",
                      opacity: 0.7,
                    }}
                  >
                    {/* Client name on top, no arrows for employees */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 20,
                          color: "#007bff",
                          textAlign: "left",
                        }}
                      >
                        {group.clientName}
                      </span>
                    </div>
                    {/* Info and controls row (empty for employees when flagged) */}
                    <div className="d-flex flex-row align-items-center justify-content-between gap-2 w-100">
                      <div style={{ minWidth: 90, maxWidth: 120 }} />
                      <div style={{ minWidth: 120, maxWidth: 160 }} />
                    </div>
                  </div>
                );
              }
              // For supervisors/admins/owners and non-flagged groups
              return (
                <div
                  key={group.id}
                  className="list-group-item d-flex flex-column py-3 mb-2 shadow-sm rounded"
                  style={{
                    background: group.segregationTomorrow ? "#ffe066" : "#fff",
                    border: group.segregationTomorrow
                      ? "2.5px solid #ffa600"
                      : "1.5px solid #e3e3e3",
                    fontSize: 14,
                    minHeight: 56,
                    boxShadow: "0 1px 6px rgba(14,98,160,0.06)",
                    transition: "background 0.2s, border 0.2s",
                  }}
                >
                  {/* Top row: arrows (if allowed) and client name */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      marginBottom: 4,
                    }}
                  >
                    {isSupervisorOrAbove && (
                      <div
                        className="d-flex flex-row gap-1"
                        style={{ marginRight: 10 }}
                      >
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title="Move up"
                          disabled={disableActions || idx === 0}
                          onClick={() => moveGroup(group.id, -1)}
                          style={{ padding: "2px 7px", fontSize: 13 }}
                        >
                          <span aria-hidden="true">▲</span>
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title="Move down"
                          disabled={
                            disableActions || idx === displayGroups.length - 1
                          }
                          onClick={() => moveGroup(group.id, 1)}
                          style={{ padding: "2px 7px", fontSize: 13 }}
                        >
                          <span aria-hidden="true">▼</span>
                        </button>
                      </div>
                    )}
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 20,
                        color: "#007bff",
                        textAlign: "left",
                      }}
                    >
                      {group.clientName}
                    </span>
                  </div>
                  {/* Info and controls row below */}
                  <div className="d-flex flex-row align-items-center justify-content-between gap-2 w-100">
                    {/* Info section */}
                    <div
                      className="d-flex flex-column flex-grow-1 justify-content-center"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <span
                        style={{
                          color: "#333",
                          opacity: 0.7,
                          fontSize: "11px",
                          fontWeight: 500,
                          letterSpacing: 0.2,
                          marginTop: 1,
                          textAlign: "left",
                          display: "block",
                        }}
                      >
                        Carros:{" "}
                        <strong style={{ fontSize: "11px", fontWeight: 600 }}>
                          {getCartCount(group.id)}
                        </strong>
                      </span>
                      <span
                        style={{
                          fontSize: "0.95rem",
                          color: "#28a745",
                          minWidth: 70,
                          textAlign: "left",
                        }}
                      >
                        Total:{" "}
                        <strong>
                          {typeof group.totalWeight === "number"
                            ? group.totalWeight.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })
                            : "?"}{" "}
                          lbs
                        </strong>
                      </span>
                    </div>
                    {/* Controls section: only trash button */}
                    <div
                      className="d-flex flex-row align-items-center gap-2"
                      style={{ minWidth: 90, maxWidth: 120 }}
                    ></div>
                    {/* Input and action section */}
                    <div
                      className="d-flex flex-row align-items-center gap-1"
                      style={{
                        minWidth: 120,
                        maxWidth: 160,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
                        onClick={() =>
                          handleInputChange(
                            group.id,
                            String(
                              Math.max(
                                0,
                                parseInt(
                                  segregatedCounts[group.id] || "0",
                                  10
                                ) - 1
                              )
                            )
                          )
                        }
                        disabled={
                          disableActions || completingGroup === group.id
                        }
                        style={{
                          minWidth: 28,
                          width: 28,
                          height: 28,
                          fontSize: 16,
                          borderRadius: 5,
                          aspectRatio: "1 / 1",
                          padding: 0,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 18,
                            lineHeight: 1,
                          }}
                        >
                          -
                        </span>
                      </button>
                      <input
                        type="number"
                        min={0}
                        className="form-control form-control-sm text-center"
                        style={{
                          width: 44,
                          fontSize: 14,
                          fontWeight: 700,
                          maxWidth: "100%",
                          padding: "2px 4px",
                        }}
                        placeholder="#"
                        value={segregatedCounts[group.id] || ""}
                        onChange={(e) =>
                          handleInputChange(group.id, e.target.value)
                        }
                        disabled={
                          disableActions || completingGroup === group.id
                        }
                      />
                      <button
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
                        onClick={() =>
                          handleInputChange(
                            group.id,
                            String(
                              parseInt(segregatedCounts[group.id] || "0", 10) +
                                1
                            )
                          )
                        }
                        disabled={
                          disableActions || completingGroup === group.id
                        }
                        style={{
                          minWidth: 28,
                          width: 28,
                          height: 28,
                          fontSize: 16,
                          borderRadius: 5,
                          aspectRatio: "1 / 1",
                          padding: 0,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 18,
                            lineHeight: 1,
                          }}
                        >
                          +
                        </span>
                      </button>
                      <button
                        className="btn btn-success btn-sm ms-1 px-2"
                        disabled={
                          disableActions ||
                          completingGroup === group.id ||
                          !segregatedCounts[group.id]
                        }
                        onClick={() => handleComplete(group.id)}
                        style={{ fontWeight: 700, fontSize: 13, minWidth: 54 }}
                      >
                        {completingGroup === group.id ? "Saving..." : "Done"}
                      </button>
                      {/* Skip Segregation button for supervisors/admins/owners */}
                      {isSupervisorOrAbove && (
                        <button
                          className="btn btn-outline-primary btn-sm ms-2"
                          style={{
                            fontWeight: 700,
                            fontSize: 18,
                            minWidth: 36,
                            padding: 0,
                          }}
                          disabled={
                            disableActions || completingGroup === group.id
                          }
                          onClick={() => handleSkipSegregation(group.id)}
                          title="Skip segregation and send to Tunnel or Conventional"
                        >
                          <span aria-hidden="true">➡️</span>
                        </button>
                      )}
                      {isSupervisorOrAbove && (
                        <>
                          <button
                            className="btn btn-warning btn-sm ms-2"
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              minWidth: 54,
                              background: "#ffa600",
                              color: "#222",
                              border: "none",
                            }}
                            onClick={async () => {
                              const newValue = !group.segregationTomorrow;
                              await updateDoc(
                                doc(db, "pickup_groups", group.id),
                                { segregationTomorrow: newValue }
                              );
                              await logActivity({
                                type: "Segregation",
                                message: `${
                                  newValue ? "Flagged" : "Unflagged"
                                } group ${
                                  group.clientName || group.id
                                } for segregation tomorrow by ${
                                  user.username || user.id
                                }`,
                              });
                            }}
                          >
                            {group.segregationTomorrow
                              ? "Unflag Tomorrow"
                              : "Tomorrow"}
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm ms-1"
                            title="Delete group"
                            onClick={() =>
                              handleDeleteSegregationGroup(group.id)
                            }
                            style={{ padding: "2px 7px", fontSize: 13 }}
                            disabled={disableActions}
                          >
                            <span aria-hidden="true">🗑️</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
