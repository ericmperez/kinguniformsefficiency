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
      // Login failed - no error message shown
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
          {/* Keypad for numeric login */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              fontSize: 18, // Smaller font size for password text
              letterSpacing: 6,
              fontWeight: 700,
              marginBottom: 10,
              minHeight: 36,
              textAlign: 'center',
              border: '1px solid #ccc',
              borderRadius: 6,
              width: 180,
              background: '#f8f9fa',
              padding: 6
            }}>{id ? '•'.repeat(id.length) : <span style={{ color: '#bbb' }}>Password</span>}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 8 }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button type="button" key={n} style={{ fontSize: 22, padding: 0, height: 48, width: 56, borderRadius: 8, border: '1px solid #ccc', background: '#fff' }} onClick={() => setId(p => (p + n).slice(0, 4))}>{n}</button>
              ))}
              <button type="button" style={{ fontSize: 22, height: 48, width: 56, borderRadius: 8, border: '1px solid #ccc', background: '#fff' }} onClick={() => setId(p => p.slice(0, -1))}>&larr;</button>
              <button type="button" style={{ fontSize: 22, height: 48, width: 56, borderRadius: 8, border: '1px solid #ccc', background: '#fff' }} onClick={() => setId(p => (p + '0').slice(0, 4))}>0</button>
              <button type="button" style={{ fontSize: 22, height: 48, width: 56, borderRadius: 8, border: '1px solid #ccc', background: '#fff' }} onClick={() => setId("")}>C</button>
            </div>
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
