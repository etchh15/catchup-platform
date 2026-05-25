import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const DISTRICTS   = ['Tala', 'Shibin El Kom', 'Menouf', 'Ashmoun', 'Quesna'];
const CATEGORIES  = ['Mechanic', 'Suspension Specialist', 'Electrician', 'Plumber', 'Painter', 'Tutor', 'Cleaning', 'Developer', 'Other'];

export default function ProfileHub({ user, role, syncPlatformEngineData }) {
  const [loading,      setLoading]      = useState(false);
  const [fullName,     setFullName]     = useState('');
  const [currentRole,  setCurrentRole]  = useState(role || 'client');
  const [district,     setDistrict]     = useState('Tala');
  const [category,     setCategory]     = useState('Mechanic');
  const [bio,          setBio]          = useState('');
  const [phone,        setPhone]        = useState('');
  const [saved,        setSaved]        = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name || '');
        setCurrentRole(data.role || 'client');
        setDistrict(data.district_tag || 'Tala');
        setCategory(data.category || 'Mechanic');
        setBio(data.bio || '');
        setPhone(data.phone_number || '');
      }
    });
  }, [user, role]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName,
        role: currentRole,
        district_tag: district,
        category: currentRole === 'specialist' ? category : null,
        bio: currentRole === 'specialist' ? bio : null,
        phone_number: phone,
        updated_at: new Date(),
      });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (syncPlatformEngineData) await syncPlatformEngineData();
    } catch (err) {
      alert('Could not save profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-layout">
      <div style={{ marginBottom: 28 }}>
        <h2>Profile settings</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Update your name, role, and public specialist information.
        </p>
      </div>

      <form onSubmit={handleSave} className="premium-card">
        <label>Display name</label>
        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />

        <label>Phone number</label>
        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01X-XXXX-XXXX" />

        <label>Your role</label>
        <div className="role-toggle-grid">
          <button type="button" className={`role-btn${currentRole === 'client' ? ' active-client' : ''}`} onClick={() => setCurrentRole('client')}>
            💼 Client — Post jobs & hire
          </button>
          <button type="button" className={`role-btn${currentRole === 'specialist' ? ' active-specialist' : ''}`} onClick={() => setCurrentRole('specialist')}>
            🛠️ Specialist — Offer services
          </button>
        </div>

        <label>District</label>
        <select value={district} onChange={e => setDistrict(e.target.value)}>
          {DISTRICTS.map(d => <option key={d}>{d}</option>)}
        </select>

        {currentRole === 'specialist' && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Specialist info
            </div>
            <label>Service category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <label>Professional bio</label>
            <textarea
              rows={4}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Describe your experience, qualifications, and what makes you the best choice for clients…"
            />
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg" style={{ marginTop: 8 }}>
          {loading ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
