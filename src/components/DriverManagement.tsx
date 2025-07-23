import React, { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getUsers } from "../services/firebaseService";

interface Driver {
  id: string;
  name: string;
  linkedUserId?: string; // Link to user account
  linkedUsername?: string; // Cached username for display
}

interface DriverManagementProps {
  drivers: Driver[];
}

interface User {
  id: string;
  username: string;
  role: string;
}

const DriverManagement: React.FC<DriverManagementProps> = ({ drivers }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Fetch users with Driver role who are not already linked
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getUsers();
        const driverRoleUsers = users.filter(
          (user: any) => user.role === "Driver"
        );
        
        // Filter out users who are already linked to drivers
        const linkedUserIds = drivers
          .filter(d => d.linkedUserId)
          .map(d => d.linkedUserId);
        
        const unlinkedUsers = driverRoleUsers.filter(
          (user: any) => !linkedUserIds.includes(user.id)
        );
        
        setAvailableUsers(unlinkedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, [drivers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    setLoading(true);
    await addDoc(collection(db, "drivers"), { name: name.trim() });
    setName("");
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    await deleteDoc(doc(db, "drivers", id));
    setLoading(false);
  };

  const handleLinkUser = async (driverId: string, userId: string) => {
    setLoading(true);
    try {
      const user = availableUsers.find(u => u.id === userId);
      if (user) {
        await updateDoc(doc(db, "drivers", driverId), {
          linkedUserId: userId,
          linkedUsername: user.username
        });
      }
      setEditingDriverId(null);
      setSelectedUserId("");
    } catch (error) {
      console.error("Error linking user:", error);
      setError("Error linking user to driver");
    }
    setLoading(false);
  };

  const handleUnlinkUser = async (driverId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "drivers", driverId), {
        linkedUserId: null,
        linkedUsername: null
      });
    } catch (error) {
      console.error("Error unlinking user:", error);
      setError("Error unlinking user from driver");
    }
    setLoading(false);
  };

  return (
    <div className="card p-4 mb-4">
      <h3 className="mb-3">Gestión de Choferes</h3>
      <form className="row g-2 align-items-end" onSubmit={handleAdd}>
        <div className="col-md-6">
          <label className="form-label">Nombre del Chofer</label>
          <input
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Nombre"
          />
        </div>
        <div className="col-md-3">
          <button
            className="btn btn-primary w-100"
            type="submit"
            disabled={loading}
          >
            Agregar
          </button>
        </div>
      </form>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      <div className="mt-4">
        <h5>Lista de Choferes</h5>
        {drivers.length === 0 ? (
          <div className="text-center text-muted">No hay choferes.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-bordered">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario Vinculado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>
                      {d.linkedUserId ? (
                        <div className="d-flex align-items-center">
                          <span className="badge bg-success me-2">
                            🔗 {d.linkedUsername} (ID: {d.linkedUserId})
                          </span>
                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleUnlinkUser(d.id)}
                            disabled={loading}
                            title="Desvincular usuario"
                          >
                            ❌
                          </button>
                        </div>
                      ) : editingDriverId === d.id ? (
                        <div className="d-flex gap-2">
                          <select
                            className="form-select form-select-sm"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                          >
                            <option value="">Seleccionar usuario...</option>
                            {availableUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.username} (ID: {user.id})
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleLinkUser(d.id, selectedUserId)}
                            disabled={!selectedUserId || loading}
                          >
                            Vincular
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setEditingDriverId(null);
                              setSelectedUserId("");
                            }}
                            disabled={loading}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setEditingDriverId(d.id)}
                          disabled={loading || availableUsers.length === 0}
                          title={availableUsers.length === 0 ? "No hay usuarios con rol 'Driver' disponibles" : "Vincular usuario"}
                        >
                          🔗 Vincular Usuario
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(d.id)}
                        disabled={loading}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {availableUsers.length === 0 && (
              <div className="alert alert-info mt-3">
                <strong>Nota:</strong> Para vincular choferes con cuentas de usuario, primero crear usuarios con rol "Driver" en la sección de Gestión de Usuarios.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverManagement;
