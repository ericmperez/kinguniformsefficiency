import React, { useState } from "react";
import { Client } from "../types";
import { UserRecord } from "../services/firebaseService";

interface Driver {
  id: string;
  name: string;
}

interface PickupWashingProps {
  clients: Client[];
  drivers: Driver[];
}

export default function PickupWashing({ clients, drivers }: PickupWashingProps) {
  const [clientId, setClientId] = useState("");
  const [weight, setWeight] = useState("");
  const [driverId, setDriverId] = useState("");
  const [success, setSuccess] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    console.log({ clientId, weight, driverId });

    const client = sortedClients.find(c => c.id === clientId);
    const driver = drivers.find(d => d.id === driverId);
    setEntries([
      {
        clientName: client?.name || "",
        driverName: driver?.name || "",
        weight,
        timestamp: new Date().toLocaleString(),
      },
      ...entries,
    ]);
  };

  // Sort clients alphabetically by name
  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="container py-4">
      <h2 className="mb-4">Entradas - Ropa Recogida</h2>
      <form className="card p-4 mb-4" onSubmit={handleSubmit} style={{ maxWidth: 500, margin: "0 auto" }}>
        <div className="mb-3">
          <label className="form-label">Cliente</label>
          <select className="form-control" value={clientId} onChange={e => setClientId(e.target.value)} required>
            <option value="">Seleccione un cliente</option>
            {sortedClients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Chofer</label>
          <select className="form-control" value={driverId} onChange={e => setDriverId(e.target.value)} required>
            <option value="">Seleccione un chofer</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Peso (libras)</label>
          <input
            type="number"
            className="form-control"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            min={0}
            step={0.1}
            required
            placeholder="Ej: 12.5"
          />
        </div>
        <button className="btn btn-primary w-100" type="submit">Registrar Entrada</button>
        {success && <div className="alert alert-success mt-3">¡Entrada registrada!</div>}
      </form>
      {/* Recent entries table */}
      {entries.length > 0 && (
        <div className="card p-3 mb-4" style={{ maxWidth: 600, margin: "0 auto" }}>
          <h5 className="mb-3">Entradas recientes</h5>
          <div className="table-responsive">
            <table className="table table-sm table-bordered">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Chofer</th>
                  <th>Peso (libras)</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{entry.clientName}</td>
                    <td>{entry.driverName}</td>
                    <td>{entry.weight}</td>
                    <td>{entry.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
