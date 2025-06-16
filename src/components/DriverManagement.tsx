import React, { useState } from "react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

interface Driver {
  id: string;
  name: string;
}

interface DriverManagementProps {
  drivers: Driver[];
}

const DriverManagement: React.FC<DriverManagementProps> = ({ drivers }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverManagement;
