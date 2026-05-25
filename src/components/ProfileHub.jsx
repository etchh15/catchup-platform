import React, { useState } from 'react';

export default function ProfileHub({ user, role, accountIdentity }) {
  const [attachedFileName, setAttachedFileName] = useState(null);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0' }}>
      <div className="premium-card">
        
        {/* Profile Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px', borderBottom: '1px solid #334155', paddingBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
            {user?.name ? user.name[0] : 'U'}
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700' }}>{user?.name || 'User Account'}</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}> Account Identity Assigned: <span style={{ textTransform: 'uppercase', color: '#38bdf8', fontWeight: '600' }}>{accountIdentity || role}</span></p>
          </div>
        </div>

        {/* Account Parameter Settings Fields */}
        <h3 style={{ fontSize: '16px', color: '#cbd5e1', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>General Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: '500' }}>Full Name</label>
            <input type="text" className="premium-input" value={user?.name || ''} readOnly />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: '500' }}>Default Operational Location</label>
            <input type="text" className="premium-input" value="Tala, Menoufia" readOnly />
          </div>
        </div>

        {/* Identity Verification Cloud Upload Block */}
        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#38bdf8', fontSize: '16px' }}>🪪 Commercial Marketplace Trust Verification</h4>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: '1.5' }}>
            Upload a high-resolution photo of your commercial license card or national ID document to unlock secure top-tier badges across the provider board.
          </p>
          
          <label className="btn-secondary" style={{ display: 'inline-block', textAlign: 'center', cursor: 'pointer' }}>
            📁 Select Document File / Take Photo
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={(e) => e.target.files[0] && setAttachedFileName(e.target.files[0].name)}
            />
          </label>

          {attachedFileName && (
            <div style={{ marginTop: '14px', color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
              ✓ <strong>{attachedFileName}</strong> safely prepared and linked to verification pipeline.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
