import React, { useState } from 'react';

export default function Navigation({ user, role, setRole, unreadCount = 1, setActiveTab, activeTab, onSignOut }) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav style={{
      background: 'rgba(30, 41, 59, 0.7)',
      backdropFilter: 'blur(12px)',
      padding: '16px max(24px, (100vw - 1200px)/2)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      {/* Platform Branding */}
      <div 
        onClick={() => setActiveTab('marketplace')} 
        style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8', cursor: 'pointer', letterSpacing: '-0.5px' }}
      >
        ⚡ CatchUp
      </div>

      {/* Main Action Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        <button 
          onClick={() => setActiveTab('marketplace')}
          style={{ background: 'none', border: 'none', color: activeTab === 'marketplace' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', fontSize: '15px', fontWeight: '500', padding: '8px 0' }}
        >
          Browse Feed
        </button>
        
        <button 
          onClick={() => setActiveTab('analytics')}
          style={{ background: 'none', border: 'none', color: activeTab === 'analytics' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', fontSize: '15px', fontWeight: '500', padding: '8px 0' }}
        >
          Insights Ledger
        </button>
        
        <button 
          onClick={() => setActiveTab('telemetry')}
          style={{ background: 'none', border: 'none', color: activeTab === 'telemetry' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', fontSize: '15px', fontWeight: '500', padding: '8px 0' }}
        >
          ⚙️ System Health
        </button>
        
        <button 
          onClick={() => setActiveTab('messages')}
          style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '15px', fontWeight: '500', position: 'relative', padding: '8px 0' }}
        >
          Workspace
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-12px', background: '#ef4444', 
              color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: '700'
            }}>{unreadCount}</span>
          )}
        </button>

        {/* Dynamic Identity Switch Toggle */}
        <button 
          onClick={() => setRole(role === 'client' ? 'specialist' : 'client')}
          style={{
            background: role === 'client' ? '#10b981' : '#6366f1',
            color: 'white', border: 'none', padding: '10px 18px', borderRadius: '10px',
            cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          Switch to {role === 'client' ? 'Specialist' : 'Client'} Mode
        </button>

        {/* Account Dropdown Control */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: '#334155', width: '38px', height: '38px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontWeight: '700', color: '#f8fafc', cursor: 'pointer', border: '2px solid #475569'
            }}
          >
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>

          {showDropdown && (
            <div style={{
              position: 'absolute', right: 0, marginTop: '12px', width: '220px',
              background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', overflow: 'hidden', zIndex: 1100
            }}>
              <div 
                onClick={() => { setActiveTab('profile'); setShowDropdown(false); }}
                style={{ padding: '14px 16px', color: '#f8fafc', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #334155' }}
              >
                👤 Profile Settings
              </div>
              <div 
                onClick={() => { setShowDropdown(false); onSignOut?.(); }}
                style={{ padding: '14px 16px', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                🚪 Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
