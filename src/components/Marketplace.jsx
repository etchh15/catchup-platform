import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import FeedEmptyState from './FeedEmptyState';

export default function Marketplace({ user, role, tasks = [], bids = [], specialistStats = {}, districtFilter, setDistrictFilter, syncPlatformEngineData }) {
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
    if (!amount || !note) {
      alert('Please provide amount and a short pitch.');
      return;
    }

    setIsSubmitting(prev => ({ ...prev, [taskId]: true }));

    try {
      const { error } = await supabase.from('bids').insert([{
        task_id: taskId,
        specialist_id: user.id,
        amount: parseFloat(amount),
        note,
        status: 'pending',
      }]);

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

  const [accepting, setAccepting] = useState({});

  const handleAcceptBid = async (bid, task) => {
    if (!bid || !task || !user) return alert('Missing context to accept bid.');
    setAccepting(prev => ({ ...prev, [bid.id]: true }));

    try {
      // mark bid accepted
      const { error: bidErr } = await supabase.from('bids').update({ status: 'accepted' }).eq('id', bid.id);
      if (bidErr) throw bidErr;

      // create workspace room for the accepted bid
      const { error: roomErr } = await supabase.from('workspace_rooms').insert([{
        task_id: task.id,
        client_id: user.id,
        specialist_id: bid.specialist_id || bid.user_id || null,
        status: 'open'
      }]);
      if (roomErr) throw roomErr;

      // update task state to in_progress
      const { error: taskErr } = await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', task.id);
      if (taskErr) throw taskErr;

      if (syncPlatformEngineData) await syncPlatformEngineData();

      alert('Bid accepted — workspace created and task moved to in_progress.');
      window.location.reload();
    } catch (err) {
      alert('Failed to accept bid: ' + (err?.message || err));
    } finally {
      setAccepting(prev => ({ ...prev, [bid.id]: false }));
    }
  };

  return (
    <div>
      <div className="market-filter-grid">
        <input
          type="text"
          className="market-search-input"
          placeholder="Search tasks or specialists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="market-select"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
        >
          <option value="all">All Regions</option>
          <option value="Tala">Tala</option>
          <option value="Shibin">Shibin</option>
        </select>

        <button type="button" className="btn-secondary refresh-feed-btn" onClick={syncPlatformEngineData}>
          Refresh
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <FeedEmptyState
          variant="tasks"
          icon="📋"
          title="No tasks"
          description="No matching tasks found."
          onReset={() => { setSearchQuery(''); setDistrictFilter('all'); }}
          showReset={false}
        />
      ) : (
        <div className="task-feed">
          {filteredTasks.map((task) => {
            const matchingBids = bids.filter((b) => b.task_id === task.id);

            return (
              <article key={task.id} className="task-card">
                <div className="task-card-header">
                  <div>
                    <div className="task-card-title">{task.title}</div>
                    <div className="task-card-meta">{task.client_name}</div>
                  </div>
                  <div className="task-price">{task.budget ? `${Number(task.budget).toLocaleString()} EGP` : 'Open budget'}</div>
                </div>

                <div className="task-card-body">{task.description}</div>

                {role === 'specialist' ? (
                  submittedBids[task.id] ? (
                    <div className="fee-breakdown-card success-note">
                      ✓ Your proposal has been registered.
                    </div>
                  ) : (
                    <div className="bid-form">
                      <label className="form-label">Your offer (EGP)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 800"
                        value={bidAmounts[task.id] || ''}
                        onChange={(e) => handleAmountChange(task.id, e.target.value)}
                      />
                      <label className="form-label">Pitch your work</label>
                      <textarea
                        className="form-textarea"
                        placeholder="Short pitch to stand out"
                        value={bidNotes[task.id] || ''}
                        onChange={(e) => handleTextChange(task.id, e.target.value)}
                      />
                      <button type="button" className="contact-btn" onClick={() => handleSubmitBid(task.id)} disabled={isSubmitting[task.id]}>
                        {isSubmitting[task.id] ? 'Committing...' : 'Send Proposal'}
                      </button>
                    </div>
                  )
                ) : (
                  <div className="proposals-block">
                    <div className="proposal-row">
                      <div>
                        <h4>Incoming Bids</h4>
                        <p className="proposal-status">{matchingBids.length} proposal{matchingBids.length === 1 ? '' : 's'} received</p>
                      </div>
                      <div className="fee-breakdown-card">
                        <h4>Client fee preview</h4>
                        <div className="fee-breakdown-row">
                          <span>Platform fee</span>
                          <strong>10%</strong>
                        </div>
                        <div className="fee-breakdown-row">
                          <span>Example on 800 EGP</span>
                          <strong>80 EGP</strong>
                        </div>
                        <div className="fee-breakdown-row" style={{ color: 'var(--color-text-primary)' }}>
                          <span>Specialist payout</span>
                          <strong>720 EGP</strong>
                        </div>
                      </div>
                    </div>

                    {matchingBids.map((b) => {
                      const amount = Number(b.amount || 0);
                      const fee = Math.round(amount * 0.1);
                      const payout = amount - fee;
                      return (
                        <div key={b.id} className="proposal-item">
                          <div className="proposal-row">
                            <div>
                              <div className="proposal-price">{amount ? `${amount.toLocaleString()} EGP` : 'Offer'}</div>
                              <div className="proposal-message">{b.note}</div>
                            </div>
                            <button
                              type="button"
                              className="contact-btn"
                              onClick={() => handleAcceptBid(b, task)}
                              disabled={task.status !== 'open' || accepting[b.id]}
                            >
                              {accepting[b.id] ? 'Accepting...' : 'Accept bid'}
                            </button>
                          </div>
                          <p className="proposal-status">Estimated payout after 10% fee: {payout.toLocaleString()} EGP</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
