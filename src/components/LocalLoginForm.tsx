import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import Segregation from "./Segregation";
import Washing from "./Washing";
import kingUniformsLogo from "../assets/King Uniforms Logo.png";
import { logActivity } from "../services/firebaseService";

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
    if (success) {
      // Log successful login
      await logActivity({
        type: "Login",
        message: `User with ID '${id}' logged in`,
        user: id,
      });
    } else {
      setError("Please enter a valid 4-digit ID number");
    }
    setLoading(false);
  };

  const handleSegregationComplete = () => {
    setShowSegregation(false);
    setShowWashing(true);
  };

  // --- Custom keypad layout and state ---
  const keypadKeys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["C", "0", "Login"],
  ];

  const handleKeypadClick = async (key: string) => {
    if (key === "Login") {
      if (id.length === 4 && !loading) {
        await handleSubmit({ preventDefault: () => {} } as any);
      }
    } else if (key === "C") {
      setId("");
      setError(null);
    } else if (id.length < 4 && key && /\d/.test(key)) {
      const newId = id + key;
      setId(newId);
      setError(null);
      if (newId.length === 4 && !loading) {
        await handleSubmit({ preventDefault: () => {} } as any);
      }
    } else if (key === "←") {
      setId((prev) => prev.slice(0, -1));
      setError(null);
    }
  };

  // --- PIN dots ---
  const renderPinDots = () => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 24,
        margin: "32px 0 40px 0",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: id.length > i ? "#fff" : "rgba(255,255,255,0.12)",
            border:
              id.length > i
                ? "2px solid #fff"
                : "2px solid rgba(255,255,255,0.18)",
            boxShadow: id.length > i ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
            transition: "all 0.2s",
          }}
        />
      ))}
    </div>
  );

  // --- Main Render ---
  return (
    <div
      className="d-flex flex-column justify-content-center align-items-center"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 60% 10%, #1a232b 60%, #0c1014 100%)",
        position: "relative",
      }}
    >
      <div style={{ marginBottom: 4, marginTop: -10 }}>
        <img
          src={kingUniformsLogo}
          alt="King Uniforms"
          style={{
            width: "min(220px, 40vw)",
            maxWidth: "80vw",
            display: "block",
            margin: "0 auto 4px auto",
            background: "none",
          }}
        />
      </div>
      {renderPinDots()}
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 0,
        }}
      >
        {keypadKeys.map((row, i) => (
          <div
            key={i}
            className="d-flex justify-content-between mb-2"
            style={{ gap: 8, width: "100%" }}
          >
            {row.map((key, j) => (
              <button
                key={key || i + "empty" + j}
                type="button"
                className="btn"
                style={{
                  width: "28vw",
                  maxWidth: 90,
                  minWidth: 48,
                  height: "7vw",
                  minHeight: 48,
                  maxHeight: 70,
                  fontSize: "min(6vw, 32px)",
                  fontWeight: 700,
                  borderRadius: 18,
                  margin: 1,
                  flex: 1,
                  background:
                    key === "Login"
                      ? "linear-gradient(135deg, #0c223a 60%, #1a232b 100%)"
                      : "rgba(255,255,255,0.08)",
                  color: key === "Login" ? "#fff" : "#fff",
                  border:
                    key === "Login"
                      ? "none"
                      : "2px solid rgba(255,255,255,0.18)",
                  boxShadow: key ? "0 2px 16px rgba(0,0,0,0.10)" : "none",
                  opacity: key ? 1 : 0,
                  pointerEvents: key ? "auto" : "none",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => handleKeypadClick(key)}
                disabled={key === "Login" ? id.length !== 4 || loading : false}
                tabIndex={-1}
              >
                {key === "Login" ? (
                  <span
                    style={{ fontSize: 18, fontWeight: 600, letterSpacing: 1 }}
                  >
                    Login
                  </span>
                ) : key === "C" ? (
                  <span
                    style={{ fontWeight: 700, color: "#b71c1c", fontSize: 22 }}
                  >
                    C
                  </span>
                ) : (
                  key
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
      {error && (
        <div
          className="alert alert-danger mt-4"
          style={{
            fontSize: 22,
            borderRadius: 16,
            minWidth: 320,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
