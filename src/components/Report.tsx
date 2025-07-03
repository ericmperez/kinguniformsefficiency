import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Client } from "../types";

interface PickupEntry {
  id: string;
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  groupId: string;
  weight: number;
  timestamp: Date;
}

export default function Report() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [entries, setEntries] = useState<PickupEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    clientId: "",
    groupId: "",
    driverId: "",
    startDate: todayStr,
    endDate: todayStr,
    minWeight: "",
    maxWeight: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch all clients, groups, drivers for filter dropdowns
    const fetchMeta = async () => {
      const [clientsSnap, groupsSnap, driversSnap] = await Promise.all([
        getDocs(collection(db, "clients")),
        getDocs(collection(db, "pickup_groups")),
        getDocs(collection(db, "drivers")),
      ]);
      setClients(
        clientsSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "",
            selectedProducts: data.selectedProducts || [],
            image: null,
            imageUrl: data.imageUrl || "",
            isRented: data.isRented || false,
            washingType: data.washingType,
            segregation: data.segregation,
          };
        })
      );
      setGroups(groupsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setDrivers(
        driversSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      // Fetch today's entries by default after meta is loaded
      fetchEntries();
    };
    fetchMeta();
    // eslint-disable-next-line
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    let q = collection(db, "pickup_entries");
    let constraints: any[] = [];
    if (filters.clientId)
      constraints.push(where("clientId", "==", filters.clientId));
    if (filters.groupId)
      constraints.push(where("groupId", "==", filters.groupId));
    if (filters.driverId)
      constraints.push(where("driverId", "==", filters.driverId));
    if (filters.startDate)
      constraints.push(
        where(
          "timestamp",
          ">=",
          Timestamp.fromDate(new Date(filters.startDate))
        )
      );
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      constraints.push(where("timestamp", "<=", Timestamp.fromDate(end)));
    }
    const qFinal = constraints.length ? query(q, ...constraints) : q;
    const snap = await getDocs(qFinal);
    let filteredEntries = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        clientId: data.clientId || "",
        clientName: data.clientName || "",
        driverId: data.driverId || "",
        driverName: data.driverName || "",
        groupId: data.groupId || "",
        weight: typeof data.weight === "number" ? data.weight : 0,
        timestamp:
          data.timestamp instanceof Timestamp
            ? data.timestamp.toDate()
            : new Date(data.timestamp),
      };
    });
    // Filter by weight if set
    if (filters.minWeight)
      filteredEntries = filteredEntries.filter(
        (e) => e.weight >= Number(filters.minWeight)
      );
    if (filters.maxWeight)
      filteredEntries = filteredEntries.filter(
        (e) => e.weight <= Number(filters.maxWeight)
      );
    setEntries(filteredEntries);
    setLoading(false);
  };

  // Group entries by clientId, then by groupId for summary
  const groupedByClient = entries.reduce((acc, entry) => {
    if (!acc[entry.clientId]) acc[entry.clientId] = {};
    if (!acc[entry.clientId][entry.groupId])
      acc[entry.clientId][entry.groupId] = [];
    acc[entry.clientId][entry.groupId].push(entry);
    return acc;
  }, {} as Record<string, Record<string, PickupEntry[]>>);

  return (
    <div className="container py-4">
      <h2 className="mb-4">Pickup Entries Report</h2>
      <div className="card p-3 mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchEntries();
          }}
        >
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Client</label>
              <select
                className="form-select"
                value={filters.clientId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, clientId: e.target.value }))
                }
              >
                <option value="">All</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Group</label>
              <select
                className="form-select"
                value={filters.groupId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, groupId: e.target.value }))
                }
              >
                <option value="">All</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.clientName} ({g.id.slice(-4)})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Driver</label>
              <select
                className="form-select"
                value={filters.driverId}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, driverId: e.target.value }))
                }
              >
                <option value="">All</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div className="col-md-3 mt-2">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Min Weight (lbs)</label>
              <input
                type="number"
                className="form-control"
                value={filters.minWeight}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, minWeight: e.target.value }))
                }
                min={0}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Max Weight (lbs)</label>
              <input
                type="number"
                className="form-control"
                value={filters.maxWeight}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, maxWeight: e.target.value }))
                }
                min={0}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end mt-2">
              <button
                className="btn btn-primary w-100"
                type="submit"
                disabled={loading}
              >
                {loading ? "Loading..." : "Filter"}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div className="card p-3">
        <h5>Results ({entries.length})</h5>
        <div className="table-responsive">
          {Object.keys(groupedByClient).length === 0 ? (
            <div className="text-center text-muted">No entries found</div>
          ) : (
            Object.entries(groupedByClient).map(([clientId, groups]) => (
              <div key={clientId} style={{ marginBottom: 32 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    color: "#007bff",
                    marginBottom: 8,
                  }}
                >
                  Client: {Object.values(groups)[0][0].clientName}
                </div>
                <table className="table table-bordered table-hover">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Driver</th>
                      <th>Date</th>
                      <th>Total Weight (lbs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groups).map(([groupId, groupEntries]) => {
                      // Summarize group: earliest date, driver, total weight
                      const totalWeight = groupEntries.reduce(
                        (sum, e) => sum + (e.weight || 0),
                        0
                      );
                      const earliest = groupEntries.reduce(
                        (min, e) => (e.timestamp < min.timestamp ? e : min),
                        groupEntries[0]
                      );
                      return (
                        <tr key={groupId}>
                          <td>{groupId}</td>
                          <td>{earliest.driverName}</td>
                          <td>{earliest.timestamp.toLocaleString()}</td>
                          <td>{totalWeight}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// When setting or using PickupEntry[], ensure all required fields are present.
