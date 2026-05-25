import React from 'react';

export default function IdentitySelection({ onSelectComplete, isLoading }) {
  return (
    <div className="identity-screen">
      <div className="identity-card">
        <div style={{ width: 52, height: 52, background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 24px' }}>⚡</div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          How will you use CatchUp?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 36, lineHeight: 1.6 }}>
          Choose your role to personalise your experience. You can change this later.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            className="identity-option"
            onClick={() => !isLoading && onSelectComplete('client')}
          >
            <div className="icon">💼</div>
            <h4>I want to hire</h4>
            <p>Post jobs and find local specialists</p>
          </div>

          <div
            className="identity-option"
            onClick={() => !isLoading && onSelectComplete('specialist')}
          >
            <div className="icon">🛠️</div>
            <h4>I want to work</h4>
            <p>Bid on local jobs and grow your business</p>
          </div>
        </div>

        {isLoading && (
          <p style={{ fontSize: 13, color: 'var(--gold)', marginTop: 24 }}>Setting up your account…</p>
        )}
      </div>
    </div>
  );
}
