// Adapted from react-login-page-main/website/src/pages/home.tsx
// This is the new login page for the main app
import React from "react";
import styled from "styled-components";
import kingUniformsLogo from "../assets/King Uniforms Logo.jpeg";
import { useAuth } from "./AuthContext";

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f8fa;
`;

const Card = styled.div`
  display: flex;
  flex-direction: row;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  max-width: 820px;
  width: 100%;
  min-height: 420px;
`;

const Left = styled.div`
  flex: 1.1;
  background: var(--ku-red, #d72328);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px 24px 24px;
  min-width: 260px;
`;

const Right = styled.div`
  flex: 1.3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  background: #fff;
`;

const Logo = styled.img`
  width: 120px;
  height: 120px;
  object-fit: contain;
  border-radius: 16px;
  background: #fff;
  margin-bottom: 1.5rem;
`;

const Welcome = styled.h2`
  font-size: 2.2rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 1.2rem;
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: #ffe066;
  margin-bottom: 2rem;
`;

const Notice = styled.div`
  background: #fffbe6;
  color: #b71c1c;
  border-left: 5px solid #ffe066;
  border-radius: 8px;
  padding: 18px 18px 18px 22px;
  margin-top: 2.5rem;
  font-size: 1.08rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 224, 102, 0.08);
  max-width: 320px;
  width: 100%;
`;

const HomeLoginPage: React.FC = () => {
  const [password, setPassword] = React.useState("");
  const { login } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const success = await login(password);
    if (!success) {
      setError("Please enter a valid numeric password");
    }
    setLoading(false);
  };

  const handleKeypad = (val: string) => {
    if (val === "C") {
      setPassword("");
      setError(null);
      return;
    }
    if (val === "←") {
      setPassword((p) => p.slice(0, -1));
      setError(null);
      return;
    }
    if (/\d/.test(val) && password.length < 8) {
      const newPass = (password + val).slice(0, 8);
      setPassword(newPass);
      setError(null);
      // If 4 digits, auto-login
      if (newPass.length === 4) {
        handleSubmit({ preventDefault: () => {} } as any);
      }
    }
  };

  return (
    <Container>
      <Card>
        <Left>
          <Logo src={kingUniformsLogo} alt="King Uniforms Logo" />
          <Welcome>Bienvenidos King</Welcome>
          <Subtitle>Por favor, ingrese para continuar</Subtitle>
          <Notice>
            <strong>Notice:</strong> <br />
            This is a demo login page. Please use your assigned numeric
            password. Contact admin for access issues.
          </Notice>
        </Left>
        <Right>
          <form
            style={{ width: "100%", maxWidth: 340 }}
            onSubmit={handleSubmit}
          >
            <h3
              style={{
                fontWeight: 700,
                marginBottom: 24,
                color: "#222",
                textAlign: "center",
              }}
            >
              Iniciar Sesión
            </h3>
            <div style={{ marginBottom: 16 }}>
              {/* Keypad for numeric login */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    letterSpacing: 6,
                    fontWeight: 700,
                    marginBottom: 10,
                    minHeight: 36,
                    textAlign: "center",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    width: 180,
                    background: "#f8f9fa",
                    padding: 6,
                  }}
                >
                  {password || (
                    <span style={{ color: "#bbb" }}>Enter Number</span>
                  )}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 56px)",
                    gap: 8,
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                      type="button"
                      key={n}
                      style={{
                        fontSize: 22,
                        padding: 0,
                        height: 48,
                        width: 56,
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: "#fff",
                      }}
                      onClick={() => handleKeypad(String(n))}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    style={{
                      fontSize: 22,
                      height: 48,
                      width: 56,
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      background: "#fff",
                    }}
                    onClick={() => handleKeypad("←")}
                  >
                    &larr;
                  </button>
                  <button
                    type="button"
                    style={{
                      fontSize: 22,
                      height: 48,
                      width: 56,
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      background: "#fff",
                    }}
                    onClick={() => handleKeypad("0")}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    style={{
                      fontSize: 22,
                      height: 48,
                      width: 56,
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      background: "#fff",
                      color: "#b71c1c",
                      fontWeight: 700,
                    }}
                    onClick={() => handleKeypad("C")}
                  >
                    C
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 6,
                background: "#007bff",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 18,
              }}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
            {error && (
              <div
                style={{
                  color: "red",
                  marginTop: 16,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}
          </form>
        </Right>
      </Card>
    </Container>
  );
};

export default HomeLoginPage;
