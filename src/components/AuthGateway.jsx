import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { fetchPlatformSettings } from '../services/supabaseService';

export default function AuthGateway({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp]     = useState(false);
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [onboarding, setOnboarding] = useState({ paused: false, reason: '' });

  useEffect(() => {
    let cancelled = false;
    fetchPlatformSettings()
      .then((settings) => {
        if (!cancelled) setOnboarding(settings?.onboarding || { paused: false, reason: '' });
      })
      .catch((err) => console.warn('Could not load onboarding setting:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        if (onboarding.paused) {
          throw new Error(onboarding.reason || 'Beta onboarding is paused right now.');
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user) onAuthSuccess(data.user);
        else setError('Check your email to confirm your account.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data?.user) onAuthSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-layout">
        <section className="auth-hero-panel" aria-label="CatchUp trust summary">
          <div className="auth-brand">
            <span className="auth-logo" aria-hidden="true">⚡</span>
            <span>CatchUp</span>
          </div>
          <div className="auth-hero-copy">
            <h1>Book trusted local specialists without the back-and-forth.</h1>
            <p>
              Find verified professionals, manage agreements, schedule visits, and keep every project update in one protected workspace.
            </p>
          </div>
          <div className="auth-proof-grid">
            <div>
              <strong>24/7</strong>
              <span>project rooms</span>
            </div>
            <div>
              <strong>Beta</strong>
              <span>payment records</span>
            </div>
            <div>
              <strong>Cairo/Alexandria</strong>
              <span>controlled launch</span>
            </div>
          </div>
        </section>

        <section className="auth-card" aria-label={isSignUp ? 'Create account' : 'Sign in'}>
          <div className="auth-card-header">
            <span className="auth-card-kicker">Welcome to CatchUp</span>
            <h2 className="auth-title">
              {isSignUp ? 'Create your account' : 'Sign in'}
            </h2>
            <p className="auth-subtitle">
              {isSignUp
                ? 'Join the controlled Cairo/Alexandria beta for trusted local services.'
                : 'Use your email to continue to your workspace.'}
            </p>
          </div>

          {onboarding.paused && (
            <div className="auth-error" role="alert">
              Beta onboarding is paused. {onboarding.reason}
            </div>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password-wrap">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (isSignUp && onboarding.paused)}
              className="auth-submit"
            >
              {loading
                ? 'Please wait...'
                : isSignUp ? 'Create account' : 'Continue'}
            </button>
          </form>

          <p className="auth-terms">
            By continuing, you agree to CatchUp's marketplace protections and <a href="/beta-policy">beta policies</a>.
          </p>

          <div className="auth-toggle">
            {isSignUp ? 'Already have an account? ' : "New to CatchUp? "}
            <button onClick={() => { setIsSignUp(v => !v); setError(''); }}>
              {isSignUp ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
