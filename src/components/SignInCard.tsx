import * as React from 'react';
import { useAuth } from './AuthContext';

export default function SignInCard({ noCard, headingProps }: { noCard?: boolean, headingProps?: React.HTMLAttributes<HTMLHeadingElement> } = {}) {
  const { login } = useAuth();
  const [id, setId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const success = await login(id);
    if (!success) {
      setError('Please enter a valid 4-digit ID number');
    }
    setLoading(false);
  };

  const headingStyle: React.CSSProperties = headingProps?.style || {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: 1,
    color: '#0E62A0',
    marginBottom: 28,
    textAlign: 'center',
    fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    textTransform: 'uppercase',
  };

  const content = (
    <>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 {...headingProps} style={headingStyle}>King Uniforms APP</h2>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <input
              type="password"
              placeholder=" "
              style={{
                width: '100%',
                padding: '18px 10px 18px 10px',
                borderRadius: 4,
                border: '1px solid #ccc',
                fontSize: 18,
                letterSpacing: 4,
                textAlign: 'center', // Center the input text
                background: 'transparent',
              }}
              value={id}
              onChange={e => setId(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoFocus
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
            />
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                display: id ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#bbb',
                fontSize: 18,
                pointerEvents: 'none',
                letterSpacing: 4,
                userSelect: 'none',
              }}
            >
              PASSWORD
            </span>
          </div>
          <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 4, background: '#007bff', color: '#fff', border: 'none', fontWeight: 600 }} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
          {error && <div style={{ color: 'red', marginTop: 16, fontWeight: 500, textAlign: 'center' }}>{error}</div>}
        </form>
      </div>
    </>
  );

  if (noCard) {
    return <div style={{ width: '100%', maxWidth: 400 }}>{content}</div>;
  }

  return (
    <div style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
      {content}
    </div>
  );
}
