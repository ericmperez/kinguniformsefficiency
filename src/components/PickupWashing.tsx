import React, { useState, useMemo, useEffect } from "react";
import { Client } from "../types";
import { UserRecord, addPickupEntry, updatePickupEntry, deletePickupEntry } from "../services/firebaseService";
import { collection, deleteDoc, doc, updateDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

interface Driver {
  id: string;
  name: string;
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
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    const client = sortedClients.find((c) => c.id === clientId);
    const driver = drivers.find((d) => d.id === driverId);
    if (!client || !driver || !weight) return;
    const entry = {
      clientId: client.id,
      clientName: client.name,
      driverId: driver.id,
      driverName: driver.name,
      weight: parseFloat(weight),
      timestamp: new Date().toISOString(),
    };
    try {
      const docRef = await addPickupEntry(entry);
      setEntries([{ ...entry, id: docRef.id }, ...entries]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setClientId("");
      setDriverId("");
      setWeight("");
    } catch (err) {
      alert("Error al guardar la entrada en Firebase");
    }
  };

  // Sort clients alphabetically by name
  const sortedClients = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Group entries by client+driver and 60-min window from the previous entry in the group
  function groupEntries(entries: any[]) {
    const groups: {
      clientName: string;
      driverName: string;
      startTime: string;
      endTime: string;
      totalWeight: number;
      entries: any[];
    }[] = [];
    const sorted = [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const lastGroupMap = new Map<string, number>(); // key: clientId|driverId, value: groupIdx
    sorted.forEach((entry) => {
      const key = entry.clientId + "|" + entry.driverId;
      const now = new Date(entry.timestamp).getTime();
      const lastIdx = lastGroupMap.get(key);
      if (
        lastIdx !== undefined &&
        now - new Date(groups[lastIdx].endTime).getTime() <= 60 * 60000
      ) {
        // Add to existing group
        groups[lastIdx].entries.push(entry);
        groups[lastIdx].endTime = entry.timestamp;
        groups[lastIdx].totalWeight += entry.weight;
      } else {
        // Start new group
        groups.push({
          clientName: entry.clientName,
          driverName: entry.driverName,
          startTime: entry.timestamp,
          endTime: entry.timestamp,
          totalWeight: entry.weight,
          entries: [entry],
        });
        lastGroupMap.set(key, groups.length - 1);
      }
    });
    return groups;
  }

  const groupedEntries = useMemo(() => groupEntries(entries), [entries]);

  // Edit an entry's weight inline
  const handleEditEntry = (entry: any) => {
    setEditEntryId(entry.id);
    setEditWeight(entry.weight.toString());
  };
  const handleEditSave = async (entry: any) => {
    if (isNaN(parseFloat(editWeight))) return;
    try {
      await updatePickupEntry(entry.id, { weight: parseFloat(editWeight) });
      setEntries(
        entries.map((e) =>
          e.id === entry.id ? { ...e, weight: parseFloat(editWeight) } : e
        )
      );
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
  const handleDeleteEntry = async (group: any, entry: any) => {
    if (!window.confirm("¿Eliminar esta entrada?")) return;
    try {
      await deletePickupEntry(entry.id);
      setEntries(entries.filter((e) => e.id !== entry.id));
    } catch (err) {
      alert("Error al eliminar la entrada");
    }
  };

  useEffect(() => {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const q = query(
      collection(db, "pickup_entries"),
      where("timestamp", ">=", today.toISOString()),
      where("timestamp", "<", tomorrow.toISOString())
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId,
          clientName: data.clientName,
          driverId: data.driverId,
          driverName: data.driverName,
          weight: data.weight,
          timestamp: data.timestamp,
        };
      });
      setEntries(
        fetched.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      );
    });
    return () => unsub();
  }, []);

  return (
    <div className="container py-4">
      <h2 className="mb-4">Entradas - Ropa Recogida</h2>
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
            type="number"
            className="form-control"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min={0}
            step={0.1}
            required
            placeholder="Ej: 12.5"
          />
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
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#007bff' }}>{group.clientName}</span> &nbsp;|&nbsp;
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>{group.driverName}</span> &nbsp;|&nbsp;
                <strong>Total de carritos:</strong> {group.entries.length}
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
                    {group.entries.map((entry, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>
                          {editEntryId === entry.id ? (
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              value={editWeight}
                              onChange={e => setEditWeight(e.target.value)}
                              style={{ width: 80, display: "inline-block" }}
                              autoFocus
                            />
                          ) : (
                            entry.weight
                          )}
                        </td>
                        <td>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                        <td>
                          {editEntryId === entry.id ? (
                            <>
                              <button className="btn btn-success btn-sm me-2" onClick={() => handleEditSave(entry)}>
                                Guardar
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={handleEditCancel}>
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-outline-primary btn-sm me-2" onClick={() => handleEditEntry(entry)}>
                                Editar
                              </button>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteEntry(group, entry)}>
                                Eliminar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold', background: '#f8f9fa' }}>
                        Peso total: {group.totalWeight.toFixed(2)} lbs
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
