import React, { useState } from 'react';

export default function Navigation({ user, role, setRole, unreadCount = 0, setActiveTab, activeTab, onSignOut }) {
  const [showDropdown, setShowDropdown] = useState(false);

  const links = [
    { id: 'marketplace', label: 'Browse' },
    { id: 'messages',    label: 'Workspace', badge: unreadCount },
    { id: 'analytics',   label: 'Insights' },
    { id: 'telemetry',   label: 'System' },
  ];

  return (
    <nav className="main-nav">
      <div className="nav-logo" onClick={() => setActiveTab('marketplace')}>
        <div className="nav-logo-icon">⚡</div>
        <span className="nav-logo-text">CatchUp</span>
      </div>

      <div className="nav-links">
        {links.map(l => (
          <button
            key={l.id}
            className={`nav-link${activeTab === l.id ? ' active' : ''}`}
            onClick={() => setActiveTab(l.id)}
          >
            {l.label}
            {l.badge > 0 && <span className="nav-badge">{l.badge}</span>}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setRole(role === 'client' ? 'specialist' : 'client')}
          className="btn btn-sm"
          style={{
            background: role === 'client' ? 'var(--blue-dim)' : 'var(--green-dim)',
            color: role === 'client' ? 'var(--blue)' : 'var(--green)',
            border: `1px solid ${role === 'client' ? 'var(--blue-border)' : 'var(--green-border)'}`,
          }}
        >
          {role === 'client' ? '💼 Client' : '🛠️ Specialist'}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="nav-avatar"
            onClick={() => setShowDropdown(v => !v)}
          >
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </button>

          {showDropdown && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 299 }}
                onClick={() => setShowDropdown(false)}
              />
              <div className="nav-dropdown">
                <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Signed in as</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>{user?.email}</div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: role === 'client' ? 'var(--blue)' : 'var(--green)' }}>
                      {role}
                    </span>
                  </div>
                </div>
                <button className="nav-dropdown-item" onClick={() => { setActiveTab('profile'); setShowDropdown(false); }}>
                  👤 Profile settings
                </button>
                <button className="nav-dropdown-item danger" onClick={() => { setShowDropdown(false); onSignOut?.(); }}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
