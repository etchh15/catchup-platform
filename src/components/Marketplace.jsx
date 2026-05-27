import React, { useState, useMemo } from 'react';
import { useToast } from './Toast';
import {
  createTask,
  submitBid,
  acceptBid,
  fetchBidsForTask,
} from '../services/supabaseService';
import FeedEmptyState from './FeedEmptyState';
import { CATEGORIES, DISTRICTS, getCategoryBadgeType, formatCurrency, getInitials, getSpecialistColor } from '../utils/statusHelpers';
import SpecialistAvatar from './SpecialistAvatar';

function Badge({ text, type = 'muted' }) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

export default function Marketplace({
  user,
  role,
  tasks = [],
  bids = [],
  specialists = [],
  districtFilter,
  setDistrictFilter,
  syncPlatformEngineData,
  setActiveTab,
}) {
  const toast = useToast();
  const [subView, setSubView] = useState('jobs');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Bid submission state (by task ID)
  const [bidAmounts, setBidAmounts] = useState({});
  const [bidNotes, setBidNotes] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [bidErrors, setBidErrors] = useState({});

  // Task creation state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Mechanic');
  const [newDistrict, setNewDistrict] = useState('Tala');
  const [newBudget, setNewBudget] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [posting, setPosting] = useState(false);

  // Filter tasks based on status and search
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status === 'archived' || t.status === 'expired') return false;
      const districtMatch =
        districtFilter === 'all' ||
        t.district_tag?.toLowerCase() === districtFilter.toLowerCase();
      const searchLower = search.toLowerCase();
      const searchMatch =
        !search ||
        t.title?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.category?.toLowerCase().includes(searchLower);
      return districtMatch && searchMatch;
    });
  }, [tasks, districtFilter, search]);

  // Filter specialists
  const filteredSpecialists = useMemo(() => {
    return specialists.filter(sp => {
      const districtMatch =
        districtFilter === 'all' ||
        sp.district_tag?.toLowerCase() === districtFilter.toLowerCase();
      const searchLower = search.toLowerCase();
      const searchMatch =
        !search ||
        sp.full_name?.toLowerCase().includes(searchLower) ||
        sp.category?.toLowerCase().includes(searchLower) ||
        sp.bio?.toLowerCase().includes(searchLower);
      return districtMatch && searchMatch;
    });
  }, [specialists, districtFilter, search]);

  const hasFilters = search.trim() !== '' || districtFilter !== 'all';

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBudget || !newDesc.trim()) {
      toast('Please fill in all fields.', 'error');
      return;
    }

    setPosting(true);
    try {
      await createTask({
        user_id: user.id,
        client_name: user.email?.split('@')[0],
        title: newTitle,
        category: newCategory,
        district_tag: newDistrict,
        budget: parseFloat(newBudget),
        description: newDesc,
        status: 'open',
      });

      setNewTitle('');
      setNewBudget('');
      setNewDesc('');
      setShowCreate(false);
      toast('Task posted successfully!', 'success');
      await syncPlatformEngineData();
    } catch (err) {
      toast('Failed to post task: ' + err.message, 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleSubmitBid = async (taskId) => {
    const bidAmount = bidAmounts[taskId];
    const proposalText = bidNotes[taskId];

    if (!bidAmount || !proposalText) {
      toast('Please enter a price and a proposal pitch.', 'error');
      return;
    }

    setSubmitting(p => ({ ...p, [taskId]: true }));
    try {
      await submitBid({
        task_id: taskId,
        specialist_id: user.id,
        amount: parseFloat(bidAmount),
        note: proposalText,
        status: 'pending',
      });

      // Clear inputs
      setBidAmounts(p => ({ ...p, [taskId]: '' }));
      setBidNotes(p => ({ ...p, [taskId]: '' }));
      setBidErrors(prev => {
        const c = { ...prev };
        delete c[taskId];
        return c;
      });

      toast('Proposal submitted!', 'success');
      await syncPlatformEngineData();
    } catch (err) {
      setBidErrors(prev => ({
        ...prev,
        [taskId]: err?.message || 'Failed to submit bid',
      }));
      console.error('Bid error:', err);
    } finally {
      setSubmitting(p => ({ ...p, [taskId]: false }));
    }
  };

  const handleAcceptBid = async (task, bid) => {
    try {
      const { gross, fee, net } = await acceptBid(
        task.id,
        bid.id,
        bid.specialist_id,
        bid.amount
      );

      toast(
        `✅ Bid accepted!\n\nTotal: ${formatCurrency(gross)}\nPlatform fee (10%): ${formatCurrency(fee)}\nSpecialist receives: ${formatCurrency(net)}`,
        'success'
      );

      await syncPlatformEngineData();
      if (setActiveTab) setActiveTab('messages');
    } catch (err) {
      toast('Error accepting bid: ' + err.message, 'error');
    }
  };

  const catBadge = {
    Mechanic: 'gold',
    Tutor: 'blue',
    Cleaning: 'green',
    Electrician: 'muted',
    Plumber: 'muted',
    Painter: 'muted',
  };

  return (
    <div className="marketplace-container">
      {/* ── Header ── */}
      <div className="marketplace-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
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
            <button
              className="btn btn-secondary btn-sm"
              onClick={syncPlatformEngineData}
            >
              ↻ Refresh
            </button>
            {role === 'client' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreate(true)}
              >
                + Post a job
              </button>
            )}
          </div>
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-3)"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search jobs, categories…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
          <select
            value={districtFilter}
            onChange={e => setDistrictFilter(e.target.value)}
            style={{ minWidth: 160, marginBottom: 0 }}
          >
            <option value="all">All districts</option>
            {DISTRICTS.map(d => (
              <option key={d} value={d.toLowerCase()}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="view-toggle">
          <button
            className={subView === 'jobs' ? 'active' : ''}
            onClick={() => setSubView('jobs')}
          >
            Jobs board
          </button>
          <button
            className={subView === 'specialists' ? 'active' : ''}
            onClick={() => setSubView('specialists')}
          >
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
              description={
                hasFilters
                  ? 'Try broadening your search or clearing the filters.'
                  : role === 'client'
                  ? 'Post your first job to start receiving proposals.'
                  : 'No open jobs right now. Check back soon.'
              }
              resetLabel="Clear filters"
              onReset={() => {
                setSearch('');
                setDistrictFilter('all');
              }}
              showReset={hasFilters}
            />
          ) : (
            filteredTasks.map(task => {
              const taskBids = bids.filter(b => b.task_id === task.id);
              const myBid = taskBids.find(b => b.specialist_id === user?.id);

              return (
                <div key={task.id} className="task-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Badge text={task.category || 'General'} type={catBadge[task.category] || 'muted'} />
                      <Badge
                        text={task.status === 'open' ? 'Open' : task.status === 'active' ? 'In progress' : task.status}
                        type={task.status === 'open' ? 'green' : task.status === 'active' ? 'blue' : 'muted'}
                      />
                    </div>
                    <span className="task-budget">
                      {task.budget ? formatCurrency(task.budget) : 'Open budget'}
                    </span>
                  </div>

                  <div className="task-title">{task.title}</div>

                  <div className="task-meta">
                    <span>📍 {task.district_tag || 'Tala'}</span>
                    <span>🕐 {task.created_at ? new Date(task.created_at).toLocaleDateString() : 'Recently'}</span>
                    <span>
                      💬 {taskBids.length} proposal{taskBids.length !== 1 ? 's' : ''}
                    </span>
                    {task.client_name && <span>👤 {task.client_name}</span>}
                  </div>

                  <p
                    style={{
                      fontSize: 14,
                      color: 'var(--text-2)',
                      lineHeight: 1.65,
                      marginBottom: 20,
                    }}
                  >
                    {task.description}
                  </p>

                  {/* Specialist: bid form */}
                  {role === 'specialist' && task.status === 'open' && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                      {myBid ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge text="Proposal submitted" type="green" />
                          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                            Waiting for client response
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: 'var(--text-2)',
                              marginBottom: 12,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}
                          >
                            Submit a proposal
                          </div>
                          {bidErrors[task.id] && (
                            <div
                              className="fee-breakdown-card"
                              style={{
                                borderColor: 'rgba(239,68,68,0.12)',
                                background: 'rgba(239,68,68,0.04)',
                                color: 'var(--danger)',
                                marginBottom: 12,
                              }}
                            >
                              {bidErrors[task.id]}
                            </div>
                          )}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '160px 1fr',
                              gap: 12,
                              marginBottom: 12,
                            }}
                          >
                            <input
                              type="number"
                              className="premium-input"
                              placeholder="Your price (EGP)"
                              value={bidAmounts[task.id] || ''}
                              onChange={e =>
                                setBidAmounts(p => ({
                                  ...p,
                                  [task.id]: e.target.value,
                                }))
                              }
                              style={{ margin: 0 }}
                            />
                            <input
                              type="text"
                              className="premium-input"
                              placeholder="Brief pitch — why are you the right person for this job?"
                              value={bidNotes[task.id] || ''}
                              onChange={e =>
                                setBidNotes(p => ({
                                  ...p,
                                  [task.id]: e.target.value,
                                }))
                              }
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
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: 'var(--text-2)',
                          marginBottom: 12,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        Proposals ({taskBids.filter(b => b.status === 'pending').length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {taskBids
                          .filter(b => b.status === 'pending')
                          .map(bid => (
                            <div key={bid.id} className="bid-card">
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 12,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 14,
                                      color: 'var(--text)',
                                      marginBottom: 2,
                                    }}
                                  >
                                    {bid.profiles?.full_name || 'Specialist'}
                                  </div>
                                  <p
                                    style={{
                                      fontSize: 13,
                                      color: 'var(--text-2)',
                                      margin: '4px 0 0',
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    "{bid.note || bid.pitch || bid.proposal_text || 'No message provided.'}"
                                  </p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div
                                    style={{
                                      fontFamily: 'var(--font-display)',
                                      fontSize: 20,
                                      fontWeight: 600,
                                      color: 'var(--green)',
                                      marginBottom: 8,
                                    }}
                                  >
                                    {formatCurrency(bid.amount ?? 0)}
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
        <div className="marketplace-feed-column">
          {filteredSpecialists.length === 0 ? (
            <FeedEmptyState
              variant="specialists"
              icon="🛠️"
              title={hasFilters ? 'No matching specialists' : 'No specialists yet'}
              description={hasFilters
                ? 'Try broadening your search or clearing the filters.'
                : 'More specialists will join soon.'}
              resetLabel="Clear filters"
              onReset={() => {
                setSearch('');
                setDistrictFilter('all');
              }}
              showReset={hasFilters}
            />
          ) : (
            filteredSpecialists.map(spec => (
              <div key={spec.id} className="specialist-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <SpecialistAvatar name={spec.full_name} size={52} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>
                      {spec.full_name || 'Specialist'}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 8px 0' }}>
                      {spec.professional_title || spec.category || 'Service Provider'}
                    </p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <span>⭐ {spec.average_rating?.toFixed(1) ?? 5.0}/5</span>
                      <span>💬 {spec.review_count ?? 0} reviews</span>
                      <span>📍 {spec.district_tag || 'Menoufia'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Create Task Modal ── */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px',
          }}
        >
          <div
            className="premium-card"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '32px',
              background: 'var(--bg-soft)',
              border: '1px solid #334155',
            }}
          >
            <h2 style={{ margin: '0 0 24px 0', fontSize: '22px', color: 'var(--text)' }}>
              Post a new job
            </h2>

            <form onSubmit={handleCreateTask}>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Job title
                </span>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g., Fix my kitchen sink"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Category
                </span>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="premium-input"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  District
                </span>
                <select
                  value={newDistrict}
                  onChange={e => setNewDistrict(e.target.value)}
                  className="premium-input"
                >
                  {DISTRICTS.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Budget (EGP)
                </span>
                <input
                  type="number"
                  className="premium-input"
                  placeholder="e.g., 500"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 24 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Description
                </span>
                <textarea
                  className="premium-input"
                  placeholder="Describe what you need..."
                  rows="4"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ resize: 'none', fontFamily: 'sans-serif' }}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  className="btn btn-primary"
                  style={{ background: 'var(--gold)' }}
                >
                  {posting ? 'Posting…' : 'Post job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
