import React, { useState, useEffect } from "react";
import { UserRole } from "./AuthContext";
import {
  addUser,
  getUsers,
  deleteUser,
  updateUser,
} from "../services/firebaseService";

interface UserRecord {
  id: string;
  username: string;
  role: UserRole;
}

type UserManagementProps = {};

const roles: UserRole[] = ["Employee", "Supervisor", "Admin", "Owner"];

export default function UserManagement(props: UserManagementProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [username, setUsername] = useState("");
  const [id, setId] = useState("");
  const [role, setRole] = useState<UserRole>("Employee");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("Employee");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const firebaseUsers = await getUsers();
      setUsers(firebaseUsers.map((u) => ({ ...u, role: u.role as UserRole })));
      setLoading(false);
    })();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(id)) {
      setError("ID must be a 4-digit number");
      return;
    }
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (users.some((u) => u.id === id)) {
      setError("ID already exists");
      return;
    }
    if (users.some((u) => u.username === username.trim())) {
      setError("Username already exists");
      return;
    }
    const newUser: UserRecord = { id, username: username.trim(), role };
    setLoading(true);
    await addUser(newUser);
    const firebaseUsers = await getUsers();
    setUsers(firebaseUsers.map((u) => ({ ...u, role: u.role as UserRole })));
    setId("");
    setUsername("");
    setRole("Employee");
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    await deleteUser(id);
    const firebaseUsers = await getUsers();
    setUsers(firebaseUsers.map((u) => ({ ...u, role: u.role as UserRole })));
    setLoading(false);
  };

  const handleEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditRole(user.role);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditUsername("");
    setEditRole("Employee");
    setError(null);
  };

  const handleEditSave = async (id: string) => {
    setError(null);
    if (!editUsername.trim()) {
      setError("Username is required");
      return;
    }
    if (users.some((u) => u.username === editUsername.trim() && u.id !== id)) {
      setError("Username already exists");
      return;
    }
    setLoading(true);
    await updateUser(id, { username: editUsername.trim(), role: editRole });
    const firebaseUsers = await getUsers();
    setUsers(firebaseUsers.map((u) => ({ ...u, role: u.role as UserRole })));
    setEditingId(null);
    setEditUsername("");
    setEditRole("Employee");
    setLoading(false);
  };

  return (
    <div className="card p-4 mb-4">
      <h3 className="mb-3">User Management</h3>
      <form className="row g-2 align-items-end" onSubmit={handleAdd}>
        <div className="col-md-2">
          <label className="form-label">ID</label>
          <input
            className="form-control"
            value={id}
            onChange={(e) =>
              setId(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            maxLength={4}
            required
            placeholder="4-digit"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Username</label>
          <input
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Name"
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Role</label>
          <select
            className="form-control"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <button
            className="btn btn-primary w-100"
            type="submit"
            disabled={loading}
          >
            Add User
          </button>
        </div>
      </form>
      {error && <div className="alert alert-danger mt-3">{error}</div>}
      <div className="mt-4">
        <h5>Current Users</h5>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-bordered">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>
                      {editingId === u.id ? (
                        <input
                          className="form-control form-control-sm"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          disabled={loading}
                        />
                      ) : (
                        u.username
                      )}
                    </td>
                    <td>
                      {editingId === u.id ? (
                        <select
                          className="form-control form-control-sm"
                          value={editRole}
                          onChange={(e) =>
                            setEditRole(e.target.value as UserRole)
                          }
                          disabled={loading}
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        u.role
                      )}
                    </td>
                    <td>
                      {editingId === u.id ? (
                        <>
                          <button
                            className="btn btn-success btn-sm me-1"
                            onClick={() => handleEditSave(u.id)}
                            disabled={loading}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleEditCancel}
                            disabled={loading}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-warning btn-sm me-1"
                            onClick={() => handleEdit(u)}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
