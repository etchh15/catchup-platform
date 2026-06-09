import React, { useEffect, useState } from 'react';
import { createWaitlistSignup, fetchPlatformSettings } from '../services/supabaseService';

const betaCategories = ['Cleaning', 'Tutoring', 'Beauty', 'Moving help', 'Simple repairs'];
const betaAreas = ['Cairo', 'Giza'];

export default function PublicLanding({ onOpenAuth }) {
  const [intent, setIntent] = useState('client');
  const [form, setForm] = useState({ name: '', email: '', phone: '', area: 'Cairo' });
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
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

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setStatus('error');
      setMessage('Add your name and email so we can reserve your beta spot.');
      return;
    }

    if (onboarding.paused) {
      setStatus('error');
      setMessage(onboarding.reason || 'Beta onboarding is paused right now.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      await createWaitlistSignup({
        full_name: form.name.trim(),
        email: form.email.trim(),
        phone_number: form.phone.trim() || null,
        city_district: form.area,
        requested_role: intent,
        source: 'public_landing',
      });
      setStatus('success');
      setMessage('You are on the CatchUp beta list. We will use this as early market signal.');
      setForm({ name: '', email: '', phone: '', area: form.area });
    } catch (err) {
      const pending = JSON.parse(window.localStorage.getItem('catchup_waitlist_pending') || '[]');
      pending.push({ ...form, requested_role: intent, saved_at: new Date().toISOString() });
      window.localStorage.setItem('catchup_waitlist_pending', JSON.stringify(pending.slice(-25)));
      setStatus('success');
      setMessage('Saved locally for now. Connect Supabase waitlist migration to persist this online.');
      console.warn('Waitlist persistence fallback:', err);
    }
  };

  return (
    <main className="public-landing">
      <nav className="public-nav" aria-label="Public navigation">
        <button type="button" className="public-brand" onClick={onOpenAuth}>
          <span className="public-brand-mark">C</span>
          <span>CatchUp</span>
        </button>
        <button type="button" className="btn btn-secondary" onClick={onOpenAuth}>
          Sign in
        </button>
      </nav>

      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="public-kicker">Controlled Cairo/Giza beta</span>
          <h1>Trusted local services, scoped before contact.</h1>
          <p>
            CatchUp helps clients and manually reviewed specialists agree on the job,
            schedule the visit, document delivery, and keep disputes inside one protected workspace.
          </p>
          <div className="public-hero-actions">
            <button type="button" className="btn btn-primary" onClick={onOpenAuth}>
              Open platform
            </button>
            <a className="btn btn-secondary" href="#waitlist">
              Join beta list
            </a>
          </div>
          <div className="public-link-row">
            <a href="/beta-policy">Beta policy</a>
            <a href="/launch-checklist">Founder-away checklist</a>
          </div>
        </div>

        <form id="waitlist" className="public-waitlist" onSubmit={handleSubmit}>
          <div className="public-form-head">
            <span className="public-kicker">Beta access</span>
            <h2>Join as client or specialist</h2>
          </div>

          <div className="segmented-control" role="group" aria-label="Beta role">
            <button
              type="button"
              className={intent === 'client' ? 'active' : ''}
              onClick={() => setIntent('client')}
            >
              Client
            </button>
            <button
              type="button"
              className={intent === 'specialist' ? 'active' : ''}
              onClick={() => setIntent('specialist')}
            >
              Specialist
            </button>
          </div>

          <label>
            Full name
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          </label>
          <label>
            Area
            <select value={form.area} onChange={(event) => updateField('area', event.target.value)}>
              {betaAreas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>

          <button type="submit" className="btn btn-primary" disabled={status === 'loading' || onboarding.paused}>
            {status === 'loading' ? 'Saving...' : onboarding.paused ? 'Onboarding paused' : 'Reserve beta spot'}
          </button>
          {message && <p className={`public-form-message ${status}`}>{message}</p>}
        </form>
      </section>

      <section className="public-beta-strip" aria-label="Supported beta scope">
        <div>
          <span className="public-kicker">Scope</span>
          <strong>{betaAreas.join(', ')}</strong>
        </div>
        <div>
          <span className="public-kicker">Categories</span>
          <strong>{betaCategories.join(', ')}</strong>
        </div>
        <div>
          <span className="public-kicker">Payments</span>
          <strong>Off-platform during beta</strong>
        </div>
      </section>
    </main>
  );
}
