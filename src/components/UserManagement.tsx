import React, { useState, useEffect } from "react";
import { UserRole, useAuth } from "./AuthContext";
import { addUser, deleteUser, updateUser } from "../services/firebaseService";
import { AppComponentKey } from "../permissions";

interface UserRecord {
  id: string;
  username: string;
  role: UserRole;
  allowedComponents?: AppComponentKey[];
  defaultPage?: AppComponentKey;
}

type UserManagementProps = {};

const roles: UserRole[] = ["Employee", "Supervisor", "Admin", "Owner"];

const componentOptions: { key: AppComponentKey; label: string }[] = [
  { key: "PickupWashing", label: "Pickup Washing" },
  { key: "ActiveInvoices", label: "Active Invoices" },
  { key: "UserManagement", label: "User Management" },
  { key: "Report", label: "Report" },
  { key: "Segregation", label: "Segregation" },
  { key: "Washing", label: "Washing" },
  { key: "GlobalActivityLog", label: "Global Activity Log" },
];

export default function UserManagement(props: UserManagementProps) {
  const { user } = useAuth(); // Get current logged-in user
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [username, setUsername] = useState("");
  const [id, setId] = useState("");
  const [role, setRole] = useState<UserRole>("Employee");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editId, setEditId] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("Employee");
  const [editAllowedComponents, setEditAllowedComponents] = useState<
    AppComponentKey[]
  >([]);
  const [editDefaultPage, setEditDefaultPage] = useState<
    AppComponentKey | undefined
  >(undefined);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Real-time Firestore listener for users
    let unsub: (() => void) | undefined;
    (async () => {
      const { collection, onSnapshot } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      unsub = onSnapshot(collection(db, "users"), (snapshot) => {
        setUsers(
          snapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: typeof data.id === "string" ? data.id : "", // Only use the 4-digit code if present
                username: data.username || "",
                role: (data.role as UserRole) || "Employee",
                allowedComponents: data.allowedComponents,
                defaultPage: data.defaultPage,
              };
            })
            .filter((user) => /^\d{4}$/.test(user.id)) // Only show users with a valid 4-digit code
        );
        setLoading(false);
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [user]);

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
    const newUser: UserRecord = {
      id,
      username: username.trim(),
      role,
      allowedComponents: role === "Owner" ? undefined : [], // Always set for non-Owner
      defaultPage: undefined,
    };
    setLoading(true);
    await addUser(newUser);
    setId("");
    setUsername("");
    setRole("Employee");
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    await deleteUser(id);
    setLoading(false);
  };

  const handleEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setEditId(user.id);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditAllowedComponents(user.allowedComponents || []);
    setEditDefaultPage(user.defaultPage);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditId("");
    setEditUsername("");
    setEditRole("Employee");
    setEditAllowedComponents([]);
    setEditDefaultPage(undefined);
    setError(null);
  };

  const handleEditSave = async (oldId: string) => {
    setError(null);
    if (!/^\d{4}$/.test(editId)) {
      setError("ID must be a 4-digit number");
      return;
    }
    if (!editUsername.trim()) {
      setError("Username is required");
      return;
    }
    if (users.some((u) => u.id === editId && u.id !== oldId)) {
      setError("ID already exists");
      return;
    }
    if (
      users.some((u) => u.username === editUsername.trim() && u.id !== oldId)
    ) {
      setError("Username already exists");
      return;
    }
    setLoading(true);
    await updateUser(oldId, {
      id: editId,
      username: editUsername.trim(),
      role: editRole,
      allowedComponents:
        editAllowedComponents.length > 0 ? editAllowedComponents : undefined,
      defaultPage: editDefaultPage,
    });
    setEditingId(null);
    setEditId("");
    setEditUsername("");
    setEditRole("Employee");
    setEditAllowedComponents([]);
    setEditDefaultPage(undefined);
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
                  <th>
                    User Number
                    <br />
                    <span
                      style={{ fontWeight: 400, fontSize: 12, color: "#888" }}
                    >
                      (4-digit login code)
                    </span>
                  </th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Allowed Components</th>
                  <th>Default Page</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id + "-" + u.username}>
                    <td>
                      {/* Always show the 4-digit code, or a warning if missing */}
                      {u.id && /^\d{4}$/.test(u.id) ? (
                        u.id
                      ) : (
                        <span className="text-danger">(No 4-digit code)</span>
                      )}
                    </td>
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
                      {editingId === u.id && editRole === "Owner" ? (
                        <div className="text-muted">
                          Owner has access to all components
                        </div>
                      ) : editingId === u.id ? (
                        <div>
                          {componentOptions.map((c) => (
                            <div key={c.key} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={editAllowedComponents.includes(c.key)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEditAllowedComponents((prev) =>
                                    checked
                                      ? [...prev, c.key]
                                      : prev.filter((key) => key !== c.key)
                                  );
                                }}
                                id={`component-${c.key}`}
                                disabled={loading}
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`component-${c.key}`}
                              >
                                {c.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>
                          {u.role === "Owner"
                            ? "All components"
                            : u.allowedComponents
                                ?.map((key) => {
                                  const component = componentOptions.find(
                                    (c) => c.key === key
                                  );
                                  return component ? component.label : null;
                                })
                                .join(", ") || (
                                <span className="text-muted">
                                  (Role default)
                                </span>
                              )}
                        </div>
                      )}
                    </td>
                    <td>
                      {editingId === u.id ? (
                        <select
                          className="form-select form-select-sm"
                          value={editDefaultPage || ""}
                          onChange={(e) =>
                            setEditDefaultPage(
                              e.target.value as AppComponentKey
                            )
                          }
                          disabled={loading}
                        >
                          <option value="">(Use role default)</option>
                          {componentOptions.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {u.defaultPage ? (
                            componentOptions.find(
                              (c) => c.key === u.defaultPage
                            )?.label || u.defaultPage
                          ) : (
                            <span className="text-muted">(Role default)</span>
                          )}
                        </span>
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
                          {/* Prevent editing/deleting the currently logged-in user for safety */}
                          <button
                            className="btn btn-warning btn-sm me-1"
                            onClick={() => handleEdit(u)}
                            disabled={Boolean(loading) || user?.id === u.id}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u.id)}
                            disabled={Boolean(loading) || user?.id === u.id}
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
                    <td colSpan={6} className="text-center text-muted">
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
