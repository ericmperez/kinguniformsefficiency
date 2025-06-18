// Adapted from react-login-page-main/website/src/pages/home.tsx
// This is the new login page for the main app
import React from "react";
import styled from "styled-components";
import kingUniformsLogo from "../assets/King Uniforms Logo.jpeg";
import { useAuth } from "./AuthContext";

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f7f8fa;
`;

const Logo = styled.img`
  width: 320px;
  max-width: 90vw;
  margin-bottom: 1.5rem;
`;

const Welcome = styled.h2`
  font-size: 2.2rem;
  font-weight: 700;
  color: #007bff;
  margin-bottom: 2.5rem;
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
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

  return (
    <Container>
      <Logo src={kingUniformsLogo} alt="King Uniforms Logo" />
      <Welcome>Bienvenidos King</Welcome>
      <Subtitle>Please log in to continue</Subtitle>
      <form style={{ width: '100%', maxWidth: 400, margin: '0 auto' }} onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Password (numbers only)"
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            inputMode="numeric"
            pattern="\\d*"
            value={password}
            onChange={e => setPassword(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 4, background: '#007bff', color: '#fff', border: 'none', fontWeight: 600 }} disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>
        {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      </form>
    </Container>
  );
};

export default HomeLoginPage;
