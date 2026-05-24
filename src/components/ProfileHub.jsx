import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ProfileHub({ user, role, syncPlatformEngineData }) {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [currentRole, setCurrentRole] = useState(role || 'client');
  const [district, setDistrict] = useState('Tala');
  const [category, setCategory] = useState('Mechanic');
  const [bio, setBio] = useState('');

  // 1. Load existing profile metadata straight from database on component initialization
  useEffect(() => {
    if (!user) return;
    
    const loadProfileData = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        setFullName(data.full_name || user.name || '');
        setCurrentRole(data.role || 'client');
        setDistrict(data.district_tag || 'Tala');
        setCategory(data.category || 'Mechanic');
        setBio(data.bio || '');
      }
    };

    loadProfileData();
  }, [user, role]);

  // 2. Commit profile edits securely over the network API
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates = {
        id: user.id,
        full_name: fullName,
        role: currentRole,
        district_tag: district,
        category: currentRole === 'specialist' ? category : null,
        bio: currentRole === 'specialist' ? bio : null,
        updated_at: new Date()
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) throw error;

      alert("✨ Profile Identity Sync Complete! Changes are live across the global feed.");
      
      // Force master state refresh so the navbar, feeds, and permissions update instantly
      if (syncPlatformEngineData) await syncPlatformEngineData();
      window.location.reload();

    } catch (err) {
      alert("Profile modification rejected: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', fontFamily: 'sans-serif' }}>
      
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px' }}>
          Account Identity Control
        </h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Manage your global marketplace credentials, switch operational roles, and update regional tags.
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="premium-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Full Name Field */}
        <div>
          <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Display Identity Name</label>
          <input 
            type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
            style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Dynamic Role Switcher Toggles */}
        <div>
          <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Marketplace Ecosystem Role</label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              type="button" onClick={() => setCurrentRole('client')}
              style={{ flex: 1, padding: '14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s',
                background: currentRole === 'client' ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                border: currentRole === 'client' ? '1px solid #38bdf8' : '1px solid #233149',
                color: currentRole === 'client' ? '#38bdf8' : '#94a3b8'
              }}
            >
              💼 Client (Post Jobs & Hire)
            </button>
            <button
              type="button" onClick={() => setCurrentRole('specialist')}
              style={{ flex: 1, padding: '14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s',
                background: currentRole === 'specialist' ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                border: currentRole === 'specialist' ? '1px solid #10b981' : '1px solid #233149',
                color: currentRole === 'specialist' ? '#10b981' : '#94a3b8'
              }}
            >
              🛠️ Specialist (Offer Services)
            </button>
          </div>
        </div>

        {/* District Node Selector */}
        <div>
          <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Regional Node (Menoufia)</label>
          <select 
            value={district} onChange={(e) => setDistrict(e.target.value)}
            style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', outline: 'none' }}
          >
            <option value="Tala">Tala</option>
            <option value="Shibin El Kom">Shibin El Kom</option>
            <option value="Menouf">Menouf</option>
            <option value="Ashmoun">Ashmoun</option>
          </select>
        </div>

        {/* Conditional Specialist Configurations Panel */}
        {currentRole === 'specialist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', borderTop: '1px solid #233149', paddingTop: '24px', marginTop: '4px' }}>
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Professional Service Category</label>
              <select 
                value={category} onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', outline: 'none' }}
              >
                <option value="Mechanic">Automotive Mechanic</option>
                <option value="Suspension Expert">Suspension Specialist</option>
                <option value="Developer">Software Developer</option>
                <option value="Tutor">Academic Tutor</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Professional Bio & Pitch</label>
              <textarea 
                rows="4" value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your qualifications, years of field experience, and localized dispatch availability parameters..."
                style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif', fontSize: '14px' }}
              />
            </div>
          </div>
        )}

        <button 
          type="submit" disabled={loading} className="btn-primary"
          style={{ padding: '14px', width: '100%', fontWeight: '700', fontSize: '15px', background: '#4f46e5', marginTop: '12px' }}
        >
          {loading ? "Synchronizing Storage Nodes..." : "Save Identity Ledger"}
        </button>

      </form>
    </div>
  );
}
