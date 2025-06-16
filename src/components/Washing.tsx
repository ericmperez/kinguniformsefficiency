import React, { useState, useEffect } from "react";
import { getClients } from "../services/firebaseService";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import type { Client } from "../types";

interface WashingProps {
  setSelectedInvoiceId?: (id: string | null) => void;
}

const Washing: React.FC<WashingProps> = ({ setSelectedInvoiceId }) => {
  const [activeTab, setActiveTab] = useState<"tunnel" | "conventional">(
    "tunnel"
  );
  const [groups, setGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
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
      g.status === "Tunnel" &&
      getWashingType(g.clientId) === "Tunnel" &&
      g.status !== "Entregado"
  );
  // Only show groups with status 'Conventional' and not 'Entregado' in Conventional tab
  const conventionalGroups = groups.filter(
    (g) =>
      g.status === "Conventional" &&
      getWashingType(g.clientId) === "Conventional" &&
      g.status !== "Entregado"
  );

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
                  return (
                    <div
                      key={group.id}
                      className="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 py-3 mb-2 shadow-sm rounded"
                      style={{
                        background: "#f8f9fa",
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
                        {/* Verification step: input for cart count */}
                        {!isVerified && isSelected && (
                          <>
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
                                if (val !== group.segregatedCarts) {
                                  setTunnelCartError(
                                    `Cart count does not match segregation value (${group.segregatedCarts}).`
                                  );
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
                                  // Always create a new invoice for this group
                                  const { addInvoice, updatePickupGroupStatus } = await import("../services/firebaseService");
                                  const newInvoice = {
                                    clientId: group.clientId,
                                    clientName: group.clientName,
                                    date: new Date().toISOString(),
                                    products: [],
                                    total: 0,
                                    carts: [],
                                    totalWeight: group.totalWeight || 0, // Save the group's total weight in the invoice
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
                      </div>
                      <div className="d-flex flex-row gap-2 align-items-center">
                        {!isSelected && !isVerified && (
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
          <div
            className="card shadow p-4 mb-4 mx-auto"
            style={{ maxWidth: 600 }}
          >
            <h5 className="mb-4 text-center" style={{ letterSpacing: 1 }}>
              Groups for Conventional Washing
            </h5>
            {loading ? (
              <div className="text-center py-5">Loading...</div>
            ) : conventionalGroups.length === 0 ? (
              <div className="text-muted text-center py-5">
                No conventional groups ready for washing.
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {conventionalGroups.map((group) => (
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
                      Carts: <strong>{group.segregatedCarts ?? "?"}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Washing;
