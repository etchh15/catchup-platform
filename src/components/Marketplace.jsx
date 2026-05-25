import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import FeedEmptyState from './FeedEmptyState';

const CATEGORIES = ['Mechanic', 'Cleaning', 'Electrician', 'Tutor', 'Plumber', 'Painter'];
const DISTRICTS   = ['Tala', 'Shibin El Kom', 'Menouf', 'Ashmoun', 'Quesna'];

function Badge({ text, type = 'muted' }) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

function SpecAvatar({ name, size = 44 }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const hue = (name?.charCodeAt(0) ?? 0) % 4;
  const colors = [
    ['var(--blue-dim)', 'var(--blue)'],
    ['var(--green-dim)', 'var(--green)'],
    ['var(--gold-dim)', 'var(--gold)'],
    ['var(--red-dim)', 'var(--red)'],
  ];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: colors[hue][0], color: colors[hue][1],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

export default function Marketplace({
  user, role, tasks = [], bids = [], specialistStats = {},
  realSpecialists = [], districtFilter, setDistrictFilter,
  syncPlatformEngineData, setActiveTab,
}) {
  const [subView, setSubView]           = useState('jobs');
  const [search, setSearch]             = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [bidAmounts, setBidAmounts]     = useState({});
  const [bidNotes, setBidNotes]         = useState({});
  const [submitting, setSubmitting]     = useState({});

  // Create task form
  const [newTitle, setNewTitle]         = useState('');
  const [newCategory, setNewCategory]   = useState('Mechanic');
  const [newDistrict, setNewDistrict]   = useState('Tala');
  const [newBudget, setNewBudget]       = useState('');
  const [newDesc, setNewDesc]           = useState('');
  const [posting, setPosting]           = useState(false);

  const catBadge = { Mechanic: 'gold', Tutor: 'blue', Cleaning: 'green', Electrician: 'muted', Plumber: 'muted', Painter: 'muted' };

  const filteredTasks = tasks.filter(t => {
    if (t.status === 'archived' || t.status === 'expired') return false;
    const d = districtFilter === 'all' || t.district_tag?.toLowerCase() === districtFilter.toLowerCase();
    const s = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase());
    return d && s;
  });

  const filteredSpecialists = realSpecialists.filter(sp => {
    const d = districtFilter === 'all' || sp.district_tag?.toLowerCase() === districtFilter.toLowerCase();
    const s = !search || sp.full_name?.toLowerCase().includes(search.toLowerCase()) || sp.category?.toLowerCase().includes(search.toLowerCase()) || sp.bio?.toLowerCase().includes(search.toLowerCase());
    return d && s;
  });

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBudget || !newDesc.trim()) { alert('Please fill in all fields.'); return; }
    setPosting(true);
    try {
      const { error } = await supabase.from('tasks').insert([{
        user_id: user.id, client_name: user.email?.split('@')[0],
        title: newTitle, category: newCategory, district_tag: newDistrict,
        budget: parseFloat(newBudget), description: newDesc, status: 'open',
      }]);
      if (error) throw error;
      setNewTitle(''); setNewBudget(''); setNewDesc(''); setShowCreate(false);
      if (syncPlatformEngineData) await syncPlatformEngineData();
    } catch (err) {
      alert('Failed to post task: ' + err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleSubmitBid = async (taskId) => {
    const amount = bidAmounts[taskId];
    const note   = bidNotes[taskId];
    if (!amount || !note) { alert('Please enter a price and a message.'); return; }
    setSubmitting(p => ({ ...p, [taskId]: true }));
    const prev = { amount, note };
    setBidAmounts(p => ({ ...p, [taskId]: '' }));
    setBidNotes(p => ({ ...p, [taskId]: '' }));
    try {
      const { error } = await supabase.from('bids').insert([{
        task_id: taskId, specialist_id: user.id,
        amount: parseFloat(amount), note, status: 'pending',
      }]);
      if (error) throw error;
      if (syncPlatformEngineData) await syncPlatformEngineData();
    } catch (err) {
      setBidAmounts(p => ({ ...p, [taskId]: prev.amount }));
      setBidNotes(p => ({ ...p, [taskId]: prev.note }));
      alert('Could not submit bid: ' + err.message);
    } finally {
      setSubmitting(p => ({ ...p, [taskId]: false }));
    }
  };

  const handleAcceptBid = async (task, bid) => {
    try {
      const gross = Number(bid.amount);
      const fee   = gross * 0.1;
      const net   = gross - fee;
      const { error: bErr } = await supabase.from('bids').update({ status: 'accepted', platform_fee_amount: fee, provider_net_payout: net }).eq('id', bid.id);
      if (bErr) throw bErr;
      const { error: tErr } = await supabase.from('tasks').update({ status: 'active', assigned_specialist_id: bid.specialist_id }).eq('id', task.id);
      if (tErr) throw tErr;
      await supabase.from('workspace_rooms').insert([{ task_id: task.id, client_id: task.user_id, specialist_id: bid.specialist_id, status: 'active' }]);
      alert(`✅ Bid accepted!\n\nTotal: ${gross.toLocaleString()} EGP\nPlatform fee (10%): ${fee.toLocaleString()} EGP\nSpecialist receives: ${net.toLocaleString()} EGP`);
      if (syncPlatformEngineData) await syncPlatformEngineData();
      if (setActiveTab) setActiveTab('messages');
    } catch (err) {
      alert('Error accepting bid: ' + err.message);
    }
  };

  const hasFilters = search.trim() !== '' || districtFilter !== 'all';
  const resetFilters = () => { setSearch(''); setDistrictFilter('all'); };

  return (
    <div className="marketplace-container">

      {/* ── Header ── */}
      <div className="marketplace-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>
              {role === 'client' ? 'Your posted jobs' : 'Available opportunities'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
              {role === 'client'
                ? 'Manage your requests and review specialist proposals.'
                : 'Browse open jobs in your area and submit proposals.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-secondary btn-sm" onClick={syncPlatformEngineData}>↻ Refresh</button>
            {role === 'client' && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Post a job</button>
            )}
          </div>
        </div>

        {/* Search + filter row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              placeholder="Search jobs, categories…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
            )}
          </div>
          <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} style={{ minWidth: 160, marginBottom: 0 }}>
            <option value="all">All districts</option>
            {DISTRICTS.map(d => <option key={d} value={d.toLowerCase()}>{d}</option>)}
          </select>
        </div>

        {/* View toggle */}
        <div className="view-toggle">
          <button className={subView === 'jobs' ? 'active' : ''} onClick={() => setSubView('jobs')}>
            Jobs board
          </button>
          <button className={subView === 'specialists' ? 'active' : ''} onClick={() => setSubView('specialists')}>
            Specialists
          </button>
        </div>
      </div>

      {/* ── Jobs view ── */}
      {subView === 'jobs' && (
        <div className="marketplace-feed-column">
          {filteredTasks.length === 0 ? (
            <FeedEmptyState
              variant="tasks"
              icon="📋"
              title={hasFilters ? 'No matching jobs' : 'No jobs posted yet'}
              description={hasFilters
                ? 'Try broadening your search or clearing the filters.'
                : role === 'client' ? 'Post your first job to start receiving proposals.' : 'No open jobs right now. Check back soon.'}
              resetLabel="Clear filters"
              onReset={resetFilters}
              showReset={hasFilters}
            />
          ) : (
            filteredTasks.map(task => {
              const taskBids = bids.filter(b => b.task_id === task.id);
              const myBid    = taskBids.find(b => b.specialist_id === user?.id);
              return (
                <div key={task.id} className="task-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Badge text={task.category || 'General'} type={catBadge[task.category] || 'muted'} />
                      <Badge text={task.status === 'open' ? 'Open' : task.status === 'active' ? 'In progress' : task.status} type={task.status === 'open' ? 'green' : task.status === 'active' ? 'blue' : 'muted'} />
                    </div>
                    <span className="task-budget">{task.budget ? `${Number(task.budget).toLocaleString()} EGP` : 'Open budget'}</span>
                  </div>

                  <div className="task-title">{task.title}</div>

                  <div className="task-meta">
                    <span>📍 {task.district_tag || 'Tala'}</span>
                    <span>🕐 {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'Recently'}</span>
                    <span>💬 {taskBids.length} proposal{taskBids.length !== 1 ? 's' : ''}</span>
                    {task.client_name && <span>👤 {task.client_name}</span>}
                  </div>

                  <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 20 }}>
                    {task.description}
                  </p>

                  {/* Specialist: bid form */}
                  {role === 'specialist' && task.status === 'open' && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                      {myBid ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge text="Proposal submitted" type="green" />
                          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Waiting for client response</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Submit a proposal</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, marginBottom: 12 }}>
                            <input
                              type="number"
                              className="premium-input"
                              placeholder="Your price (EGP)"
                              value={bidAmounts[task.id] || ''}
                              onChange={e => setBidAmounts(p => ({ ...p, [task.id]: e.target.value }))}
                              style={{ margin: 0 }}
                            />
                            <input
                              type="text"
                              className="premium-input"
                              placeholder="Brief pitch — why are you the right person for this job?"
                              value={bidNotes[task.id] || ''}
                              onChange={e => setBidNotes(p => ({ ...p, [task.id]: e.target.value }))}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              className="btn btn-primary"
                              disabled={submitting[task.id]}
                              onClick={() => handleSubmitBid(task.id)}
                            >
                              {submitting[task.id] ? 'Submitting…' : 'Send proposal'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Client: incoming bids */}
                  {role === 'client' && taskBids.length > 0 && user?.id === task.user_id && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Proposals ({taskBids.filter(b => b.status === 'pending').length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {taskBids.filter(b => b.status === 'pending').map(bid => (
                          <div key={bid.id} className="bid-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                                  {bid.profiles?.full_name || 'Specialist'}
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '4px 0 0', lineHeight: 1.5 }}>
                                  "{bid.note || bid.proposal_text || 'No message provided.'}"
                                </p>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>
                                  {Number(bid.amount ?? 0).toLocaleString()} EGP
                                </div>
                                {task.status === 'open' && (
                                  <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => handleAcceptBid(task, bid)}
                                  >
                                    Accept & open workspace
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Specialists view ── */}
      {subView === 'specialists' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredSpecialists.length === 0 ? (
            <FeedEmptyState
              variant="specialists"
              icon="🛠️"
              title={hasFilters ? 'No specialists found' : 'No specialists yet'}
              description={hasFilters ? 'Try a different search or district.' : 'Specialists will appear here once they register.'}
              resetLabel="Clear filters"
              onReset={resetFilters}
              showReset={hasFilters}
            />
          ) : (
            filteredSpecialists.map(sp => {
              const stats = specialistStats[sp.id] || { rating: 5.0, count: 0 };
              return (
                <div key={sp.id} className="spec-card">
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                    <SpecAvatar name={sp.full_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{sp.full_name || 'Specialist'}</span>
                        {sp.is_verified && <span title="Verified" style={{ color: 'var(--blue)', fontSize: 13 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, margin: '2px 0 4px' }}>{sp.category || sp.professional_title || 'Professional'}</div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-3)' }}>
                        <span>⭐ {Number(stats.rating).toFixed(1)}</span>
                        <span>{stats.count > 0 ? `${stats.count} reviews` : 'New'}</span>
                        <span>📍 {sp.district_tag || 'Tala'}</span>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16, flexGrow: 1 }}>
                    {sp.bio || 'No bio provided yet.'}
                  </p>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-primary btn-sm">Request offer</button>
                    <button className="btn btn-secondary btn-sm">View profile</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Create task modal ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000, padding: '20px' }}>
          <div style={{ maxWidth: 580, width: '100%', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 20, padding: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Post a new job</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <label>Job title</label>
              <input type="text" className="premium-input" placeholder="e.g. Fix rear suspension on 2018 Kia Cerato" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label>Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ marginBottom: 16 }}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>District</label>
                  <select value={newDistrict} onChange={e => setNewDistrict(e.target.value)} style={{ marginBottom: 16 }}>
                    {DISTRICTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <label>Budget (EGP)</label>
              <input type="number" className="premium-input" placeholder="e.g. 1500" value={newBudget} onChange={e => setNewBudget(e.target.value)} required />

              <label>Job description</label>
              <textarea className="premium-textarea" rows={4} placeholder="Describe the work needed, any specific requirements, your availability…" value={newDesc} onChange={e => setNewDesc(e.target.value)} required />

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={posting} style={{ flex: 1 }}>
                  {posting ? 'Posting…' : 'Publish job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
