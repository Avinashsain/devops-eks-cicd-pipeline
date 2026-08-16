import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoogleAuthEnabled } from '../hooks/useGoogleAuthEnabled';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const googleEnabled = useGoogleAuthEnabled();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(fullName, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-center">
      <form className="card auth-form" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        {error && <p className="error">{error}</p>}
        <label htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          type="text"
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="hint">At least 8 characters.</p>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Register'}
        </button>
        {googleEnabled && (
          <>
            <div className="divider">or</div>
            <a href="/api/auth/google" className="google-btn">
              <i className="bi bi-google" /> Continue with Google
            </a>
          </>
        )}
        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
