import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import Segregation from "./Segregation";
import Washing from "./Washing";

export default function LocalLoginForm() {
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSegregation, setShowSegregation] = useState(false);
  const [showWashing, setShowWashing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (id === "0001") {
      setShowSegregation(true);
      setLoading(false);
      return;
    }
    const success = await login(id);
    if (!success) {
      setError("Please enter a valid 4-digit ID number");
    }
    setLoading(false);
  };

  const handleSegregationComplete = () => {
    setShowSegregation(false);
    setShowWashing(true);
  };

  if (showSegregation) {
    return (
      <Segregation hideArrows onGroupComplete={handleSegregationComplete} />
    );
  }
  if (showWashing) {
    return <Washing />;
  }

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: "80vh" }}
    >
      <form
        className="card p-4 shadow-sm"
        style={{ minWidth: 320 }}
        onSubmit={handleSubmit}
      >
        <h2 className="mb-4 text-center">King Uniforms</h2>
        <div className="mb-3">
          <label htmlFor="id" className="form-label">
            4-Digit ID Number
          </label>
          <input
            id="id"
            className="form-control"
            value={id}
            onChange={(e) =>
              setId(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            autoFocus
            required
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="e.g. 1234"
          />
        </div>
        <button
          className="btn btn-primary w-100"
          type="submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </form>
    </div>
  );
}
