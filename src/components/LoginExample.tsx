// Adapted from react-login-page-main/website/src/pages/Example.tsx
import React from "react";
import styled from "styled-components";

const ExampleBox = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  padding: 2rem;
  margin-bottom: 1rem;
`;

const LoginExample: React.FC = () => (
  <ExampleBox>
    <form>
      <div style={{ marginBottom: 16 }}>
        <input
          type="password"
          placeholder="Password (numbers only)"
          style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          inputMode="numeric"
          pattern="\\d*"
        />
      </div>
      <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 4, background: '#007bff', color: '#fff', border: 'none', fontWeight: 600 }}>Log In</button>
    </form>
  </ExampleBox>
);

export default LoginExample;
