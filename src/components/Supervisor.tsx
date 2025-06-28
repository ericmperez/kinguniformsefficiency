import React, { useEffect, useState } from "react";
import { getAllPickupGroups } from "../services/firebaseService";
import { useAuth } from "./AuthContext";
import { Client, Invoice } from "../types";

const STATUS_STEPS = [
  { key: "Segregation", label: "Segregando" },
  { key: "Tunnel", label: "Tunnel/Conventional" },
  { key: "Empaque", label: "Empaque" },
  { key: "Entregado", label: "Lista para Entrega" },
];

function getStepIndex(status: string) {
  const idx = STATUS_STEPS.findIndex(
    (s) =>
      status === s.key ||
      (s.key === "Tunnel" && (status === "Tunnel" || status === "Conventional"))
  );
  return idx === -1 ? 0 : idx;
}

const Supervisor: React.FC<{ clients: Client[]; invoices: Invoice[] }> = ({
  clients,
  invoices,
}) => {
  const [pickupGroups, setPickupGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      setGroupsLoading(true);
      const groups = await getAllPickupGroups();
      setPickupGroups(groups);
      setGroupsLoading(false);
    })();
  }, []);

  // Helper: format date
  function formatDate(dateStr: string) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, "0");
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}  ${d.toLocaleString("en-US", {
      month: "short",
    })} ${d.getDate()}`;
  }

  // Only show groups that are not deleted and are for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visiblePickupGroups = pickupGroups.filter((g) => {
    if (g.status === "deleted") return false;
    if (g.status === "Entregado" || g.status === "Boleta Impresa") {
      const groupDate = g.endTime || g.startTime;
      if (!groupDate) return false;
      const groupDay = new Date(groupDate);
      groupDay.setHours(0, 0, 0, 0);
      if (groupDay < today) return false;
    }
    return true;
  });

  return (
    <div className="container py-4">
      <h2 className="mb-4 text-center">Today's Client Groups Overview</h2>
      {groupsLoading ? (
        <div>Loading groups...</div>
      ) : visiblePickupGroups.length === 0 ? (
        <div className="text-muted">No groups for today.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-light">
              <tr>
                <th>Client</th>
                <th>Date Created</th>
                <th>Total Pounds</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePickupGroups.map((group, groupIdx) => {
                const stepIdx = getStepIndex(group.status);
                const totalSteps = STATUS_STEPS.length;
                const percent = (stepIdx + 1) / totalSteps;
                const interpolateColor = (a: string, b: string, t: number) => {
                  const ah = a.match(/\w\w/g)!.map((x) => parseInt(x, 16));
                  const bh = b.match(/\w\w/g)!.map((x) => parseInt(x, 16));
                  const rh = ah.map((av, i) =>
                    Math.round(av + (bh[i] - av) * t)
                  );
                  return `rgb(${rh[0]},${rh[1]},${rh[2]})`;
                };
                const barColor = interpolateColor(
                  "#ffe066",
                  "#51cf66",
                  percent
                );
                const createdDate = formatDate(group.startTime);
                return (
                  <tr key={group.id || groupIdx}>
                    <td>
                      <span style={{ fontSize: 20, fontWeight: 700 }}>
                        {group.clientName}
                      </span>
                    </td>
                    <td>{createdDate}</td>
                    <td>
                      {typeof group.totalWeight === "number"
                        ? group.totalWeight.toFixed(2)
                        : "?"}
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={group.status}
                        disabled
                        style={{ minWidth: 120 }}
                      >
                        <option value="Segregation">Segregacion</option>
                        <option value="Tunnel">Tunnel</option>
                        <option value="Conventional">Conventional</option>
                        <option value="Empaque">Empaque</option>
                        <option value="Entregado">Boleta Impresa</option>
                        <option value="deleted">Deleted</option>
                      </select>
                      <div style={{ marginTop: 8 }}>
                        <div
                          style={{
                            height: 16,
                            background: "#eee",
                            borderRadius: 8,
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              width: `${((stepIdx + 1) / totalSteps) * 100}%`,
                              background: barColor,
                              height: "100%",
                              transition: "width 0.3s, background 0.3s",
                            }}
                          ></div>
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: 10,
                              color: "#555",
                              padding: "0 4px",
                              pointerEvents: "none",
                            }}
                          >
                            {STATUS_STEPS.map((step, i) => (
                              <span
                                key={step.key}
                                style={{
                                  fontWeight: i === stepIdx ? 700 : 400,
                                }}
                              >
                                {i + 1}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 2,
                            textAlign: "center",
                          }}
                        >
                          {STATUS_STEPS[stepIdx]?.label}
                        </div>
                      </div>
                    </td>
                    <td>
                      {/* Actions can be added here if needed for supervisor */}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Supervisor;
