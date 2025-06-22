import React, { useState, useMemo, useEffect, useRef } from "react";
import { Client } from "../types";
import {
  UserRecord,
  addPickupEntry,
  updatePickupEntry,
  deletePickupEntry,
  addPickupGroup,
  updatePickupGroupStatus,
  getTodayPickupGroups,
} from "../services/firebaseService";
import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

interface Driver {
  id: string;
  name: string;
}

interface PickupEntry {
  id?: string;
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  groupId: string;
  weight: number;
  timestamp: Date | Timestamp;
}

interface PickupGroup {
  id: string;
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  startTime: string;
  endTime: string;
  totalWeight: number;
  status: string;
}

interface PickupWashingProps {
  clients: Client[];
  drivers: Driver[];
}

export default function PickupWashing({
  clients,
  drivers,
}: PickupWashingProps) {
  const [clientId, setClientId] = useState("");
  const [weight, setWeight] = useState("");
  const [driverId, setDriverId] = useState("");
  const [success, setSuccess] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<string>("");
  const [groupStatusUpdating, setGroupStatusUpdating] = useState<string | null>(
    null
  );
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [showKeypad, setShowKeypad] = useState(false);

  // Fetch today's groups in real time
  useEffect(() => {
    // Get today's date range in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const q = query(
      collection(db, "pickup_groups"),
      where("startTime", ">=", today.toISOString()),
      where("startTime", "<", tomorrow.toISOString())
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetchedGroups = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(fetchedGroups);
    });
    return () => unsub();
  }, []);

  // Sort clients alphabetically by name
  const sortedClients = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // --- Helper to update group in Firestore ---
  const updateGroupTotals = async (
    groupId: string,
    entriesForGroup: PickupEntry[]
  ) => {
    if (!groupId) return;
    if (entriesForGroup.length === 0) return;
    const totalWeight = entriesForGroup.reduce((sum, e) => sum + e.weight, 0);
    // Convert all timestamps to Date for comparison
    const getDate = (t: Date | Timestamp) =>
      t instanceof Date ? t : t.toDate();
    const endTimeDate = entriesForGroup.reduce(
      (latest, e) =>
        getDate(e.timestamp) > latest ? getDate(e.timestamp) : latest,
      getDate(entriesForGroup[0].timestamp)
    );
    await updateDoc(doc(db, "pickup_groups", groupId), {
      totalWeight,
      endTime: endTimeDate.toISOString(),
    });
  };

  // When adding a new entry, check if it fits an existing group or needs a new group
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    const client = sortedClients.find((c) => c.id === clientId);
    const driver = drivers.find((d) => d.id === driverId);
    if (!client || !driver || !weight) return;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);
    let group = groups.find(
      (g) =>
        g.clientId === client.id &&
        g.driverId === driver.id &&
        new Date(g.endTime) >= oneHourAgo
    );
    let groupId = group ? group.id : null;
    let groupData: PickupGroup | null = null;
    if (!groupId) {
      // Create new group
      let initialStatus = "Segregation";
      if (client.washingType === "Tunnel") {
        initialStatus = "Tunnel";
      } else if (client.washingType === "Conventional") {
        initialStatus = "Conventional";
      }
      const groupData = {
        clientId: client.id,
        clientName: client.name,
        driverId: driver.id,
        driverName: driver.name,
        startTime: now,
        endTime: now,
        totalWeight: parseFloat(weight),
        status: initialStatus,
      };
      const groupRef = await addPickupGroup(groupData);
      groupId = groupRef.id;
      setGroups([{ ...groupData, id: groupId }, ...groups]);
    }
    const entry: Omit<PickupEntry, "id"> = {
      clientId: client.id,
      clientName: client.name,
      driverId: driver.id,
      driverName: driver.name,
      groupId: groupId!,
      weight: parseFloat(weight),
      timestamp: now,
    };
    try {
      const docRef = await addPickupEntry(entry);
      const newEntry: PickupEntry = { ...entry, id: docRef.id };
      setEntries([newEntry, ...entries]);
      // Update group totals
      const updatedEntries = [newEntry, ...entries].filter(
        (e) => e.groupId === groupId
      );
      await updateGroupTotals(groupId!, updatedEntries);
      // After updating group totals (on add, edit, or delete), also update numCarts in Firestore
      await updateDoc(doc(db, "pickup_groups", groupId), {
        numCarts: updatedEntries.length,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      // Do not clear clientId or driverId so they remain prepopulated
      // setClientId("");
      // setDriverId("");
      setWeight("");
      setShowKeypad(false); // Hide keypad on submit
    } catch (err) {
      alert("Error al guardar la entrada en Firebase");
    }
  };

  // Group entries by groupId (using Firestore groups)
  const groupedEntries = useMemo(() => {
    // Sort groups by most recent (latest endTime or startTime) first
    return groups
      .map((group) => {
        const groupEntries = entries.filter((e) => e.groupId === group.id);
        const totalWeight = groupEntries.reduce((sum, e) => sum + e.weight, 0);
        // Find the latest timestamp in the group's entries, fallback to group.endTime/startTime
        let latest = group.endTime
          ? new Date(group.endTime)
          : new Date(group.startTime);
        if (groupEntries.length > 0) {
          const maxEntry = groupEntries.reduce((max, e) => {
            const t =
              e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp);
            return t > max ? t : max;
          }, latest);
          latest = maxEntry;
        }
        return {
          ...group,
          entries: groupEntries,
          totalWeight,
          _latest: latest,
        };
      })
      .filter((g) => g.entries.length > 0)
      .sort((a, b) => b._latest - a._latest); // Most recent group first
  }, [groups, entries]);

  // Edit an entry's weight inline
  const handleEditEntry = (entry: any) => {
    setEditEntryId(entry.id);
    setEditWeight(entry.weight.toString());
  };
  const handleEditSave = async (entry: PickupEntry) => {
    if (isNaN(parseFloat(editWeight))) return;
    try {
      await updatePickupEntry(entry.id!, { weight: parseFloat(editWeight) });
      const updatedEntries = entries.map((e) =>
        e.id === entry.id ? { ...e, weight: parseFloat(editWeight) } : e
      );
      setEntries(updatedEntries);
      // Update group totals
      const groupEntries = updatedEntries.filter(
        (e) => e.groupId === entry.groupId
      );
      await updateGroupTotals(entry.groupId, groupEntries);
      // After updating group totals (on add, edit, or delete), also update numCarts in Firestore
      await updateDoc(doc(db, "pickup_groups", entry.groupId), {
        numCarts: groupEntries.length,
      });
      setEditEntryId(null);
      setEditWeight("");
    } catch (err) {
      alert("Error al editar la entrada");
    }
  };
  const handleEditCancel = () => {
    setEditEntryId(null);
    setEditWeight("");
  };

  // Delete an entry
  const handleDeleteEntry = async (group: PickupGroup, entry: PickupEntry) => {
    if (!window.confirm("¿Eliminar esta entrada?")) return;
    try {
      await deletePickupEntry(entry.id!);
      const updatedEntries = entries.filter((e) => e.id !== entry.id);
      setEntries(updatedEntries);
      // Update group totals
      const groupEntries = updatedEntries.filter((e) => e.groupId === group.id);
      await updateGroupTotals(group.id, groupEntries);
      // After updating group totals (on add, edit, or delete), also update numCarts in Firestore
      await updateDoc(doc(db, "pickup_groups", group.id), {
        numCarts: groupEntries.length,
      });
    } catch (err) {
      alert("Error al eliminar la entrada");
    }
  };

  // Handler to update group status
  const handleStatusChange = async (groupId: string, status: string) => {
    setGroupStatusUpdating(groupId);
    await updatePickupGroupStatus(groupId, status);
    setGroupStatusUpdating(null);
  };

  useEffect(() => {
    // Get today's date range in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const q = query(
      collection(db, "pickup_entries"),
      where("timestamp", ">=", Timestamp.fromDate(today)),
      where("timestamp", "<", Timestamp.fromDate(tomorrow))
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName,
          driverId: data.driverId,
          driverName: data.driverName,
          groupId: data.groupId,
          weight: data.weight,
          timestamp:
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate()
              : new Date(data.timestamp),
        };
      });
      setEntries(
        fetched.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      );
    });
    return () => unsub();
  }, []);

  // Find the most recent entry for prepopulation
  const lastEntry = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    // Sort by timestamp descending
    return [...entries].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }, [entries]);

  // Prepopulate client and driver from last entry if empty
  useEffect(() => {
    if (lastEntry) {
      if (!clientId) setClientId(lastEntry.clientId);
      if (!driverId) setDriverId(lastEntry.driverId);
    }
  }, [lastEntry]);

  // Keypad input handler
  const handleKeypadInput = (val: string) => {
    setWeight((prev) => {
      if (val === "C") return "";
      if (val === "←") return prev.slice(0, -1);
      if (val === "." && prev.includes(".")) return prev;
      if (val === "." && prev === "") return "0.";
      return prev + val;
    });
    if (weightInputRef.current) weightInputRef.current.focus();
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4 text-center">Entradas Representantes de Servicios</h2>
      <form
        className="card p-4 mb-4"
        onSubmit={handleSubmit}
        style={{ maxWidth: 500, margin: "0 auto" }}
      >
        <div className="mb-3">
          <label className="form-label">Cliente</label>
          <select
            className="form-control"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Seleccione un cliente</option>
            {sortedClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Chofer</label>
          <select
            className="form-control"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            required
          >
            <option value="">Seleccione un chofer</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Peso (libras)</label>
          <input
            type="text"
            className="form-control"
            value={weight}
            ref={weightInputRef}
            onFocus={() => setShowKeypad(true)}
            onChange={(e) => setWeight(e.target.value)}
            min={0}
            step={0.1}
            required
            placeholder="Ej: 12.5"
            inputMode="decimal"
            autoComplete="off"
          />
          {showKeypad && (
            <div
              className="card p-2 mt-2"
              style={{ maxWidth: 300, margin: "0 auto" }}
            >
              <div className="d-flex flex-wrap justify-content-center gap-2">
                {[
                  "7",
                  "8",
                  "9",
                  "4",
                  "5",
                  "6",
                  "1",
                  "2",
                  "3",
                  "0",
                  ".",
                  "←",
                  "C",
                ].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-outline-dark mb-2${
                      key === "C"
                        ? " btn-danger"
                        : key === "←"
                        ? " btn-warning"
                        : ""
                    }`}
                    style={{ width: 60, height: 48, fontSize: 22 }}
                    onClick={() => handleKeypadInput(key)}
                  >
                    {key === "←" ? <>&larr;</> : key}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary w-100 mt-2"
                onClick={() => setShowKeypad(false)}
              >
                Ocultar teclado
              </button>
            </div>
          )}
        </div>
        <button className="btn btn-primary w-100" type="submit">
          Registrar Entrada
        </button>
        {success && (
          <div className="alert alert-success mt-3">¡Entrada registrada!</div>
        )}
      </form>
      {/* Grouped entries table */}
      {groupedEntries.length > 0 && (
        <div
          className="card p-3 mb-4"
          style={{ maxWidth: 700, margin: "0 auto" }}
        >
          <h5 className="mb-3">Entradas recientes agrupadas</h5>
          {groupedEntries.map((group, idx) => (
            <div key={idx} className="mb-4">
              <div className="mb-2">
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "#007bff",
                  }}
                >
                  {group.clientName}
                </span>{" "}
                &nbsp;|&nbsp;
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "#28a745",
                  }}
                >
                  {group.driverName}
                </span>{" "}
                &nbsp;|&nbsp;
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "#6c757d",
                  }}
                >
                  Carros: {group.entries.length}
                </span>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Peso (libras)</th>
                      <th>Hora</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((entry: PickupEntry, i: number) => {
                      let timeString = "";
                      if (entry.timestamp instanceof Date) {
                        timeString = entry.timestamp.toLocaleTimeString();
                      } else if (
                        entry.timestamp &&
                        typeof entry.timestamp.toDate === "function"
                      ) {
                        timeString = entry.timestamp
                          .toDate()
                          .toLocaleTimeString();
                      } else {
                        timeString = new Date(
                          entry.timestamp as any
                        ).toLocaleTimeString();
                      }
                      return (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>
                            {editEntryId === entry.id ? (
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={editWeight}
                                onChange={(e) => setEditWeight(e.target.value)}
                                style={{ width: 80, display: "inline-block" }}
                                autoFocus
                              />
                            ) : (
                              entry.weight
                            )}
                          </td>
                          <td>{timeString}</td>
                          <td>
                            {editEntryId === entry.id ? (
                              <>
                                <button
                                  className="btn btn-success btn-sm me-2"
                                  onClick={() => handleEditSave(entry)}
                                >
                                  Guardar
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleEditCancel}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn btn-outline-primary btn-sm me-2"
                                  onClick={() => handleEditEntry(entry)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() =>
                                    handleDeleteEntry(group, entry)
                                  }
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div
                  style={{
                    width: "100%",
                    textAlign: "right",
                    fontWeight: "bold",
                    background: "#f8f9fa",
                    padding: "8px 12px",
                    borderTop: "1px solid #dee2e6",
                  }}
                >
                  Peso total: {Math.round(group.totalWeight)} lbs
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
