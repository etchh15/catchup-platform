import React from 'react';

export default function IdentitySelection({ onSelectComplete, isLoading }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1e2f 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        padding: '40px',
        borderRadius: '24px',
        maxWidth: '560px',
        width: '100%',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{
          background: 'linear-gradient(45deg, #38bdf8, #818cf8)',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          margin: '0 auto 24px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 10px 20px rgba(56, 189, 248, 0.3)',
        }}>⚡</div>
        <h2 style={{ color: '#f8fafc', margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>
          Setup Your CatchUp Identity
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.6', marginBottom: '40px' }}>
          Confirm your workspace identity to wire your profile to the correct client or specialist cluster.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div
            onClick={() => !isLoading && onSelectComplete('client')}
            style={{ background: '#0f172a', padding: '28px 20px', borderRadius: '16px', border: '2px solid #334155', cursor: 'pointer', textAlign: 'center' }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💼</div>
            <h4 style={{ color: '#f8fafc', margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600' }}>I want to Hire</h4>
            <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Post tasks and review proposals.</p>
          </div>
          <div
            onClick={() => !isLoading && onSelectComplete('specialist')}
            style={{ background: '#0f172a', padding: '28px 20px', borderRadius: '16px', border: '2px solid #334155', cursor: 'pointer', textAlign: 'center' }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛠️</div>
            <h4 style={{ color: '#f8fafc', margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600' }}>I want to Work</h4>
            <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Bid on local orders and grow revenue.</p>
          </div>
        </div>
        {isLoading && (
          <p style={{ color: '#38bdf8', fontSize: '13px', marginTop: '24px' }}>Creating secure database entries...</p>
        )}
      </div>
    </div>
  );
}
