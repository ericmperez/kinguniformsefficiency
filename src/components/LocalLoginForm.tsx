import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export default function LocalLoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const success = await login(username, password);
    if (!success) {
      setError("Invalid username or password");
    }
    setLoading(false);
  };

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
      <form className="card p-4 shadow-sm" style={{ minWidth: 320 }} onSubmit={handleSubmit}>
        <h2 className="mb-4 text-center">Login</h2>
        <div className="mb-3">
          <label htmlFor="username" className="form-label">Username</label>
          <input
            id="username"
            className="form-control"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            id="password"
            type="password"
            className="form-control"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary w-100" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </form>
    </div>
  );
}
