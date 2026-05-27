import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { fetchUserProfile, updateUserRole } from '../services/supabaseService';

export default function ProfileHub({ user, role, syncPlatformEngineData }) {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachedFileName, setAttachedFileName] = useState(null);

  useEffect(() => {
    if (!user) return;

    fetchUserProfile(user.id)
      .then(setProfile)
      .catch(err => {
        console.error('Profile load error:', err);
        toast('Failed to load profile', 'error');
      })
      .finally(() => setLoading(false));
  }, [user, toast]);

  const handleRoleChange = async (newRole) => {
    if (!user) return;

    setLoading(true);
    try {
      await updateUserRole(user.id, newRole);
      setProfile(prev =>
        prev ? { ...prev, role: newRole } : null
      );
      toast(`Switched to ${newRole} mode`, 'success');
      if (syncPlatformEngineData) await syncPlatformEngineData();
    } catch (err) {
      toast('Failed to change role: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--gold)', padding: '40px', textAlign: 'center' }}>
        ⏳ Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ color: 'var(--text-3)', padding: '40px', textAlign: 'center' }}>
        Unable to load profile
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0' }}>
      <div className="premium-card">
        {/* Profile Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '32px',
            borderBottom: '1px solid #334155',
            paddingBottom: '24px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#ffffff',
            }}
          >
            {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700' }}>
              {profile?.full_name || 'User'}
            </h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
              Role:{' '}
              <span
                style={{
                  textTransform: 'uppercase',
                  color: role === 'client' ? '#38bdf8' : '#10b981',
                  fontWeight: '600',
                }}
              >
                {role}
              </span>
            </p>
          </div>
        </div>

        {/* Account Settings */}
        <h3
          style={{
            fontSize: '16px',
            color: '#cbd5e1',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Account Details
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: '500' }}>
              Full Name
            </label>
            <input
              type="text"
              className="premium-input"
              value={profile?.full_name || ''}
              readOnly
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              className="premium-input"
              value={profile?.email || user?.email || ''}
              readOnly
            />
          </div>
        </div>

        {/* Role Selection */}
        <h3
          style={{
            fontSize: '16px',
            color: '#cbd5e1',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Account Type
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div
            onClick={() => !loading && handleRoleChange('client')}
            style={{
              padding: '20px',
              borderRadius: '12px',
              border: role === 'client' ? '2px solid #38bdf8' : '1px solid #334155',
              background: role === 'client' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-soft)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>💼</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>I want to hire</div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Post jobs and find specialists
            </p>
          </div>
          <div
            onClick={() => !loading && handleRoleChange('specialist')}
            style={{
              padding: '20px',
              borderRadius: '12px',
              border: role === 'specialist' ? '2px solid #10b981' : '1px solid #334155',
              background: role === 'specialist' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-soft)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>🛠️</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>I want to work</div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Bid on jobs and grow your business
            </p>
          </div>
        </div>

        {/* Verification */}
        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#38bdf8', fontSize: '16px' }}>
            🪪 Verification Status
          </h4>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: '1.5' }}>
            {profile?.is_verified
              ? '✅ Your account is verified'
              : 'Verification helps build trust with other users on the platform'}
          </p>
          {!profile?.is_verified && (
            <label
              className="btn btn-secondary"
              style={{ display: 'inline-block', textAlign: 'center', cursor: 'pointer' }}
            >
              📁 Upload Document
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => e.target.files[0] && setAttachedFileName(e.target.files[0].name)}
              />
            </label>
          )}
          {attachedFileName && (
            <div style={{ marginTop: '14px', color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
              ✓ <strong>{attachedFileName}</strong> prepared for upload
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
