import React, { useState } from 'react';
import NotificationCenter from './NotificationCenter';
import { useLanguage } from '../i18n/LanguageContext';

export default function Navigation({
  user,
  profile,
  role,
  setRole,
  unreadCount = 0,
  setActiveTab,
  activeTab,
  onSignOut,
  notifications = [],
  notificationLoading = false,
  onNotificationClick = null,
  onMarkAsRead = null,
  onMarkAllAsRead = null,
  onClearAll = null,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { language, toggleLanguage, t } = useLanguage();

  const links = [
    { id: 'dashboard', label: t('home', 'Home') },
    { id: 'marketplace', label: t('browse', 'Browse') },
    { id: 'messages',    label: t('workspace', 'Workspace'), badge: unreadCount },
    ...(role === 'admin'
      ? [
          { id: 'analytics', label: t('operations', 'Operations') },
          { id: 'telemetry', label: t('system', 'System') },
        ]
      : []),
  ];
  const canSwitchMarketplaceRole = role === 'client' || role === 'specialist';

  return (
    <nav className="main-nav">
      <div className="nav-logo" onClick={() => setActiveTab('dashboard')}>
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

      <div className="nav-actions">
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadCount}
          loading={notificationLoading}
          onNotificationClick={onNotificationClick}
          onMarkAsRead={onMarkAsRead}
          onMarkAllAsRead={onMarkAllAsRead}
          onClearAll={onClearAll}
        />

        {canSwitchMarketplaceRole && (
          <button
            onClick={() => setRole(role === 'client' ? 'specialist' : 'client')}
            className="btn btn-sm"
            style={{
              background: role === 'client' ? 'var(--blue-dim)' : 'var(--green-dim)',
              color: role === 'client' ? 'var(--blue)' : 'var(--green)',
              border: `1px solid ${role === 'client' ? 'var(--blue-border)' : 'var(--green-border)'}`,
            }}
          >
            {role === 'client' ? t('client', 'Client') : t('specialist', 'Specialist')}
          </button>
        )}

        <button type="button" className="nav-language-toggle" onClick={toggleLanguage}>
          {language === 'ar' ? 'EN' : 'AR'}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="nav-avatar"
            onClick={() => setShowDropdown(v => !v)}
            aria-label="Account menu"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="nav-avatar-img" />
            ) : (
              user?.email?.[0]?.toUpperCase() ?? 'U'
            )}
          </button>

          {showDropdown && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 299 }}
                onClick={() => setShowDropdown(false)}
              />
              <div className="nav-dropdown">
                <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>{t('signedInAs', 'Signed in as')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>{user?.email}</div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: role === 'client' ? 'var(--blue)' : 'var(--green)' }}>
                      {role === 'admin' ? t('platformAdmin', 'platform admin') : role === 'client' ? t('client', 'client') : t('specialist', 'specialist')}
                    </span>
                  </div>
                </div>
                <button className="nav-dropdown-item" onClick={() => { setActiveTab('profile'); setShowDropdown(false); }}>
                  {t('profileSettings', 'Profile settings')}
                </button>
                <button className="nav-dropdown-item" onClick={() => { setActiveTab('help'); setShowDropdown(false); }}>
                  {t('helpDesk', 'Help Desk')}
                </button>
                <button className="nav-dropdown-item danger" onClick={() => { setShowDropdown(false); onSignOut?.(); }}>
                  {t('signOut', 'Sign out')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
