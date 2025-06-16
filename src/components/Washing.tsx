import React, { useState, useEffect } from "react";
import { getTodayPickupGroups, getClients } from "../services/firebaseService";
import type { Client } from "../types";

const Washing: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"tunnel" | "conventional">("tunnel");
  const [groups, setGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTunnelGroup, setSelectedTunnelGroup] = useState<any | null>(null);
  const [tunnelCartInput, setTunnelCartInput] = useState("");
  const [tunnelCartError, setTunnelCartError] = useState("");

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
  }, []);

  // Helper to get client washing type
  const getWashingType = (clientId: string) =>
    clients.find((c) => c.id === clientId)?.washingType;

  // Only show groups with status 'Tunnel' in Tunnel tab
  const tunnelGroups = groups.filter(
    (g) => g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel"
  );
  // Only show groups with status 'Conventional' in Conventional tab
  const conventionalGroups = groups.filter(
    (g) => g.status === "Conventional" && getWashingType(g.clientId) === "Conventional"
  );

  // Set group status to 'Tunnel' or 'Conventional' when they appear in the respective tab
  useEffect(() => {
    if (!loading) {
      tunnelGroups.forEach((group) => {
        if (group.status !== "Tunnel") {
          import("../services/firebaseService").then(({ updatePickupGroupStatus }) => {
            updatePickupGroupStatus(group.id, "Tunnel");
          });
        }
      });
      conventionalGroups.forEach((group) => {
        if (group.status !== "Conventional") {
          import("../services/firebaseService").then(({ updatePickupGroupStatus }) => {
            updatePickupGroupStatus(group.id, "Conventional");
          });
        }
      });
    }
    // eslint-disable-next-line
  }, [loading, tunnelGroups.length, conventionalGroups.length]);

  return (
    <div className="container py-4">
      <h2 className="mb-4">Washing</h2>
      <ul className="nav nav-tabs mb-3">
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
            className={`nav-link${activeTab === "conventional" ? " active" : ""}`}
            onClick={() => setActiveTab("conventional")}
          >
            Conventional
          </button>
        </li>
      </ul>
      <div>
        {activeTab === "tunnel" && (
          <div>
            <h4>Tunnel Washing</h4>
            {loading ? (
              <div>Loading...</div>
            ) : tunnelGroups.length === 0 ? (
              <div className="text-muted">No tunnel groups ready for washing.</div>
            ) : (
              <ul className="list-group mb-4">
                {tunnelGroups.map((group) => (
                  <li
                    key={group.id}
                    className={`list-group-item${selectedTunnelGroup && selectedTunnelGroup.id === group.id ? " active" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedTunnelGroup(group);
                      setTunnelCartInput("");
                      setTunnelCartError("");
                    }}
                  >
                    <strong>{group.clientName}</strong> - Carts: {group.segregatedCarts ?? "?"}
                  </li>
                ))}
              </ul>
            )}
            {/* Modal-like input for selected group */}
            {selectedTunnelGroup && (
              <div className="card p-3 mb-3" style={{ maxWidth: 400, margin: "0 auto" }}>
                <h5 className="mb-3">Count Carts for {selectedTunnelGroup.clientName}</h5>
                <div className="mb-2">Expected (from segregation): <strong>{selectedTunnelGroup.segregatedCarts}</strong></div>
                <input
                  type="number"
                  min={0}
                  className="form-control mb-2"
                  placeholder="How many carts did you count?"
                  value={tunnelCartInput}
                  onChange={e => setTunnelCartInput(e.target.value)}
                  autoFocus
                />
                {tunnelCartError && <div className="text-danger mb-2">{tunnelCartError}</div>}
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const val = parseInt(tunnelCartInput);
                      if (isNaN(val)) {
                        setTunnelCartError("Please enter a valid number.");
                        return;
                      }
                      if (val !== selectedTunnelGroup.segregatedCarts) {
                        setTunnelCartError(`Cart count does not match segregation value (${selectedTunnelGroup.segregatedCarts}).`);
                        return;
                      }
                      setTunnelCartError("");
                      alert("Cart count matches segregation value! Proceed with washing.");
                      setSelectedTunnelGroup(null);
                    }}
                  >
                    Confirm
                  </button>
                  <button className="btn btn-secondary" onClick={() => setSelectedTunnelGroup(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "conventional" && (
          <div>
            <h4>Conventional Washing</h4>
            {loading ? (
              <div>Loading...</div>
            ) : conventionalGroups.length === 0 ? (
              <div className="text-muted">No conventional groups ready for washing.</div>
            ) : (
              <ul className="list-group mb-4">
                {conventionalGroups.map((group) => (
                  <li key={group.id} className="list-group-item">
                    <strong>{group.clientName}</strong> - Carts: {group.segregatedCarts ?? "?"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Washing;
