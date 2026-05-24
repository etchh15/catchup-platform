import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthGateway({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAuthentication = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('🎯 Registration successful! If email verification is enabled, please check your inbox.');
        if (data?.user) onAuthSuccess(data.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data?.user) onAuthSuccess(data.user);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
      <div className="premium-card" style={{ maxWidth: '420px', width: '100%', padding: '40px', background: 'rgba(30, 41, 59, 0.15)', border: '1px solid #233149', borderRadius: '16px', backdropFilter: 'blur(16px)', boxShadow: '0 20px 40px rgba(0,0,0,0.7)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            {isSignUp ? 'Create Your Account' : 'Welcome to CatchUp'}
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            {isSignUp ? 'Join the professional regional ecosystem' : 'Sign in to monitor your workspace parameters'}
          </p>
        </div>

        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleAuthentication} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</label>
            <input
              type="email"
              required
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: '#0b0f19', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '12px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: '#0b0f19', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: '700', marginTop: '8px', background: '#38bdf8', color: '#0f172a' }}
          >
            {loading ? 'Processing System Credentials...' : isSignUp ? 'Register Account' : 'Secure Login'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          {isSignUp ? 'Already have an profile registry?' : 'New to our regional platform node?'}{' '}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setErrorMessage(''); }}
            style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontWeight: '600', padding: 0 }}
          >
            {isSignUp ? 'Sign In Here' : 'Create an Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
