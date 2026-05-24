import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import FeedEmptyState from './FeedEmptyState';

export default function Marketplace({ user, role, tasks = [], bids = [], specialistStats = {}, realSpecialists = [], districtFilter, setDistrictFilter, syncPlatformEngineData, setActiveTab }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bidAmounts, setBidAmounts] = useState({});
  const [bidNotes, setBidNotes] = useState({});
  const [isSubmitting, setIsSubmitting] = useState({});
  const [submittedBids, setSubmittedBids] = useState({});

  const filteredTasks = (tasks || []).filter(t => {
    if (t.status === 'archived' || t.status === 'expired') return false;
    if (districtFilter && districtFilter !== 'all' && t.district_tag && t.district_tag.toLowerCase() !== districtFilter.toLowerCase()) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q);
  });

  const handleAmountChange = (taskId, value) => setBidAmounts(prev => ({ ...prev, [taskId]: value }));
  const handleTextChange = (taskId, value) => setBidNotes(prev => ({ ...prev, [taskId]: value }));

  const handleSubmitBid = async (taskId) => {
    const amount = bidAmounts[taskId];
    const note = bidNotes[taskId];
    if (!amount || !note) { alert('Please provide amount and a short pitch.'); return; }

    setIsSubmitting(prev => ({ ...prev, [taskId]: true }));

    try {
      const { error } = await supabase
        .from('bids')
        .insert([{ task_id: taskId, specialist_id: user.id, amount: parseFloat(amount), note, status: 'pending' }]);

      if (error) throw error;

      if (syncPlatformEngineData) await syncPlatformEngineData();

      setSubmittedBids(prev => ({ ...prev, [taskId]: true }));
    } catch (err) {
      const isDuplicate = err?.code === '23505' || /duplicate/i.test(err?.message || err?.details || '');
      if (isDuplicate) {
        setSubmittedBids(prev => ({ ...prev, [taskId]: true }));
        alert('You have already submitted a proposal for this opportunity.');
      } else {
        alert('Failed to submit proposal: ' + (err?.message || err));
        setBidAmounts(prev => ({ ...prev, [taskId]: amount }));
        setBidNotes(prev => ({ ...prev, [taskId]: note }));
      }
    } finally {
      setIsSubmitting(prev => ({ ...prev, [taskId]: false }));
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search tasks or specialists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f8fafc' }}
        />

        <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f8fafc' }}>
          <option value="all">All Regions</option>
          <option value="Tala">Tala</option>
          <option value="Shibin">Shibin</option>
        </select>

        <button onClick={syncPlatformEngineData} className="btn-secondary">Refresh</button>
      </div>

      <div>
        {filteredTasks.length === 0 ? (
          <FeedEmptyState variant="tasks" icon="📋" title="No tasks" description="No matching tasks found." onReset={() => { setSearchQuery(''); setDistrictFilter('all'); }} showReset={false} />
        ) : (
          filteredTasks.map(task => {
            const matchingBids = bids.filter(b => b.task_id === task.id);

            return (
              <div key={task.id} className="premium-card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{task.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>{task.client_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>{task.budget ? `${Number(task.budget).toLocaleString()} EGP` : 'Open budget'}</div>
                </div>

                <div style={{ marginBottom: 12 }}>{task.description}</div>

                {role === 'specialist' ? (
                  submittedBids[task.id] ? (
                    <div style={{ padding: 12, background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>✓ Your proposal has been registered.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px', gap: 8 }}>
                      <input type="number" placeholder="EGP" value={bidAmounts[task.id] || ''} onChange={(e) => handleAmountChange(task.id, e.target.value)} style={{ padding: 8, borderRadius: 6 }} />
                      <input type="text" placeholder="Short pitch" value={bidNotes[task.id] || ''} onChange={(e) => handleTextChange(task.id, e.target.value)} style={{ padding: 8, borderRadius: 6 }} />
                      <button onClick={() => handleSubmitBid(task.id)} disabled={isSubmitting[task.id]} className="btn-primary">{isSubmitting[task.id] ? 'Committing...' : 'Send Proposal'}</button>
                    </div>
                  )
                ) : (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Incoming Bids ({matchingBids.length})</div>
                    {matchingBids.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 6, background: '#0f172a', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{b.amount ? `${Number(b.amount).toLocaleString()} EGP` : 'Offer'}</div>
                          <div style={{ color: '#94a3b8', fontSize: 12 }}>{b.note}</div>
                        </div>
                        {user?.id === task.user_id && task.status === 'open' && (
                          <button onClick={() => { /* accept flow handled elsewhere */ alert('Accepting...'); }} className="btn-primary">Accept</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
