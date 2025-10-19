import { useState } from 'react';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('Registration successful. You can now log in.');
      } else {
        setMessage(data.message || 'Registration failed.');
      }
    } catch (err) {
      setMessage('Something went wrong.');
    }
  };

  const outer = {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingTop: '4.5rem',
    paddingLeft: '1rem',
    paddingBottom: '2rem',
    paddingRight: '12rem', // nudge left just like Login
    background:
      'radial-gradient(700px 700px at 100% 0%, rgba(79,70,229,.10) 0%, rgba(79,70,229,0) 55%), linear-gradient(180deg,#f3f4f6 0%, #ffffff 60%)'
  };

  const card = {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '0.75rem',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: '420px'
  };

  const input = {
    width: '100%',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem'
  };

  const button = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#4f46e5',
    color: '#fff',
    fontWeight: '600',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer'
  };

  const messageStyle = {
    marginTop: '1rem',
    textAlign: 'center',
    color: message.includes('successful') ? 'green' : 'red'
  };

  return (
    <div style={outer} className="register-wrap">
      <form onSubmit={handleRegister} style={card}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Create Account</h2>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
          Fill in your details to register
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={input}
        />

        <button type="submit" style={button}>Register</button>
        <p style={messageStyle}>{message}</p>
      </form>

      <style>
        {`
          @media (max-width: 1200px) { .register-wrap { padding-right: 8rem !important; } }
          @media (max-width: 900px)  { .register-wrap { padding-right: 3rem !important; } }
          @media (max-width: 640px)  { .register-wrap { justify-content: center; padding-right: 1rem !important; } }
        `}
      </style>
    </div>
  );
};

export default Register;
