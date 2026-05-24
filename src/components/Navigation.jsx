import React, { useState } from 'react';

const navItems = [
  { id: 'marketplace', label: 'Browse', icon: '📌' },
  { id: 'messages', label: 'Workspace', icon: '💬' },
  { id: 'analytics', label: 'Insights', icon: '📊' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export default function Navigation({ user, role, setRole, unreadCount = 0, setActiveTab, activeTab, onSignOut }) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <>
      <nav className="top-nav-bar">
        <div className="top-nav-left">
          <button type="button" className="top-nav-item" onClick={() => setActiveTab('marketplace')}>
            <span aria-hidden="true">⚡</span> <span style={{ fontWeight: 700 }}>CatchUp</span>
          </button>
          <div className="top-nav-links">
            <button type="button" className={`top-nav-item ${activeTab === 'marketplace' ? 'active' : ''}`} onClick={() => setActiveTab('marketplace')}>
              Browse Feed
            </button>
            <button type="button" className={`top-nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
              Insights Ledger
            </button>
            <button type="button" className={`top-nav-item ${activeTab === 'telemetry' ? 'active' : ''}`} onClick={() => setActiveTab('telemetry')}>
              System Health
            </button>
            <button type="button" className={`top-nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
              Workspace
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
          </div>
        </div>

        <div className="top-nav-actions">
          <button
            type="button"
            className="action-btn"
            style={{ background: role === 'client' ? 'var(--success)' : 'var(--accent)', color: 'var(--bg)' }}
            onClick={() => setRole(role === 'client' ? 'specialist' : 'client')}
          >
            Switch to {role === 'client' ? 'Specialist' : 'Client'} Mode
          </button>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn-outline"
              style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </button>

            {showDropdown && (
              <div className="profile-sidebar-card" style={{ position: 'absolute', right: 0, top: '48px', width: 220, padding: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)' }}>
                <button type="button" className="top-nav-item" style={{ width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 0, borderBottom: '1px solid var(--border)' }} onClick={() => { setActiveTab('profile'); setShowDropdown(false); }}>
                  👤 Profile Settings
                </button>
                <button type="button" className="top-nav-item" style={{ width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 0, color: 'var(--danger)' }} onClick={() => { setShowDropdown(false); onSignOut?.(); }}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="mobile-nav-bar">
        <div className="mobile-nav-grid">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span aria-hidden="true" style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
