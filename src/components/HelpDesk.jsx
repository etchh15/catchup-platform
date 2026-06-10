import React, { useEffect, useMemo, useState } from 'react';
import {
  createHelpCase,
  fetchHelpCaseMessages,
  fetchHelpCases,
  sendHelpCaseMessage,
  updateHelpCaseStatus,
} from '../services/supabaseService';
import { useToast } from './Toast';
import { formatDate } from '../utils/statusHelpers';

const categoryOptions = [
  ['general', 'General help'],
  ['account', 'Account'],
  ['verification', 'Verification'],
  ['job', 'Job or workspace'],
  ['payment', 'Off-platform payment'],
  ['dispute', 'Dispute'],
  ['safety', 'Safety concern'],
];

const priorityOptions = [
  ['normal', 'Normal'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
];

const statusLabels = {
  open: 'Open',
  waiting_on_user: 'Waiting on user',
  resolved: 'Resolved',
};

export default function HelpDesk({ user, role }) {
  const toast = useToast();
  const isAdmin = role === 'admin';
  const [cases, setCases] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseStatusFilter, setCaseStatusFilter] = useState('active');
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [handoffCaseId, setHandoffCaseId] = useState('');
  const [draft, setDraft] = useState({
    category: 'general',
    priority: 'normal',
    subject: '',
    body: '',
  });
  const [reply, setReply] = useState('');

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId) || cases[0] || null,
    [activeCaseId, cases]
  );
  const caseIsResolved = activeCase?.status === 'resolved';

  const loadCases = async () => {
    setLoading(true);
    try {
      const rows = await fetchHelpCases({
        role,
        userId: user?.id,
        status: isAdmin ? caseStatusFilter : 'all',
        limit: 80,
      });
      setCases(rows);
      setActiveCaseId((current) => (rows.some((item) => item.id === current) ? current : rows[0]?.id || ''));
    } catch (err) {
      toast('Could not load help cases: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (caseId) => {
    if (!caseId) {
      setMessages([]);
      return;
    }

    setMessageLoading(true);
    try {
      setMessages(await fetchHelpCaseMessages(caseId));
    } catch (err) {
      toast('Could not load case messages: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadCases();
  }, [user?.id, role, caseStatusFilter]);

  useEffect(() => {
    loadMessages(activeCase?.id);
  }, [activeCase?.id]);

  const handleCreateCase = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await createHelpCase({
        userId: user.id,
        role,
        ...draft,
      });
      setDraft({ category: 'general', priority: 'normal', subject: '', body: '' });
      await loadCases();
      setActiveCaseId(created.id);
      setHandoffCaseId(created.id);
      setShowNewCaseForm(false);
      toast('Help case opened. Admin can now reply privately.', 'success');
    } catch (err) {
      toast('Could not open help case: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (event) => {
    event.preventDefault();
    if (!activeCase) return;
    if (caseIsResolved) {
      toast(isAdmin ? 'Reopen this case before sending another admin reply.' : 'This case is done. Open another case if you still need help.', 'error');
      return;
    }
    setBusy(true);
    try {
      await sendHelpCaseMessage({
        caseId: activeCase.id,
        senderId: user.id,
        senderRole: role === 'admin' ? 'admin' : role === 'specialist' ? 'specialist' : 'client',
        body: reply,
      });
      setReply('');
      await Promise.all([loadMessages(activeCase.id), loadCases()]);
      toast('Reply sent.', 'success');
    } catch (err) {
      toast('Could not send reply: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (!isAdmin || !activeCase) return;
    setBusy(true);
    try {
      await updateHelpCaseStatus(activeCase.id, status);
      await loadCases();
      toast(`Case marked ${statusLabels[status] || status}.`, 'success');
    } catch (err) {
      toast('Could not update case status: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="help-desk-shell">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-kicker">Help Desk</span>
          <h2>{isAdmin ? 'Private user support cases' : 'Get help from CatchUp'}</h2>
          <p className="dashboard-muted">
            {isAdmin
              ? 'Review private user cases, reply as platform admin, and close support loops.'
              : 'Open a private case for account, verification, job, payment, dispute, or safety support.'}
          </p>
        </div>
        <div className="help-desk-filter">
          {isAdmin ? (
            <select className="premium-input" value={caseStatusFilter} onChange={(event) => setCaseStatusFilter(event.target.value)}>
              <option value="active">Active</option>
              <option value="open">Open only</option>
              <option value="waiting_on_user">Waiting on user</option>
              <option value="resolved">Resolved</option>
              <option value="all">All cases</option>
            </select>
          ) : cases.length > 0 ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNewCaseForm((current) => !current)}>
              {showNewCaseForm ? 'Close case form' : 'Open another case'}
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadCases} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className={`help-desk-grid${!isAdmin && !showNewCaseForm ? ' support-focused' : ''}`}>
        <aside className="premium-card help-case-list" aria-label="Help cases">
          <div className="dashboard-panel-head compact">
            <span className="dashboard-kicker">{isAdmin ? 'Cases' : 'Your cases'}</span>
            <span className="dashboard-alert-count">{cases.length}</span>
          </div>
          {loading ? (
            <p className="dashboard-muted">Loading cases...</p>
          ) : cases.length === 0 ? (
            <p className="dashboard-muted">No help cases yet. Open one below and admin will reply privately.</p>
          ) : cases.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`help-case-item${activeCase?.id === item.id ? ' active' : ''}`}
              onClick={() => setActiveCaseId(item.id)}
            >
              <strong>{item.subject}</strong>
              <span>{statusLabels[item.status] || item.status} · {item.category} · {item.priority}</span>
              {isAdmin && <em>{item.profiles?.full_name || item.profiles?.email || 'User'}</em>}
              <small>{formatDate(item.last_message_at)}</small>
            </button>
          ))}
        </aside>

        <section className="premium-card help-case-thread">
          {activeCase ? (
            <>
              <div className="help-case-header">
                <div>
                  <span className="dashboard-kicker">{activeCase.category} support</span>
                  <h3>{activeCase.subject}</h3>
                  <p>
                    {statusLabels[activeCase.status] || activeCase.status} · {activeCase.priority}
                    {isAdmin && ` · ${activeCase.profiles?.email || 'unknown user'}`}
                  </p>
                </div>
                {isAdmin && (
                  <div className="help-case-actions">
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleStatusChange('open')}>Open</button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleStatusChange('waiting_on_user')}>Waiting</button>
                    <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => handleStatusChange('resolved')}>Resolve</button>
                  </div>
                )}
              </div>

              {!isAdmin && handoffCaseId === activeCase.id && (
                <div className="help-handoff-panel">
                  <strong>Private case opened</strong>
                  <span>Keep all updates here. CatchUp admin can review this case history and reply privately.</span>
                </div>
              )}

              <div className="help-message-stream">
                {messageLoading ? (
                  <p className="dashboard-muted">Loading messages...</p>
                ) : messages.length === 0 ? (
                  <p className="dashboard-muted">No messages yet.</p>
                ) : messages.map((message) => {
                  const isMe = message.sender_id === user.id;
                  return (
                    <article key={message.id} className={`help-message ${isMe ? 'me' : 'them'}`}>
                      <div>
                        <strong>{message.sender_role === 'admin' ? 'CatchUp admin' : message.profiles?.full_name || message.profiles?.email || 'User'}</strong>
                        <span>{formatDate(message.created_at)}</span>
                      </div>
                      <p>{message.body}</p>
                    </article>
                  );
                })}
              </div>

              {caseIsResolved ? (
                <div className="help-resolved-note">
                  {isAdmin
                    ? 'This case is done. Reopen it before continuing the support thread.'
                    : 'This case is done. The private thread is closed, but you can open another case if you still need help.'}
                </div>
              ) : null}

              {!caseIsResolved && (
                <form className="help-reply-form" onSubmit={handleSendReply}>
                  <textarea
                    className="premium-input"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={isAdmin ? 'Reply as CatchUp admin...' : 'Add more detail for admin...'}
                    rows={4}
                  />
                  <button type="submit" className="btn btn-primary" disabled={busy || !reply.trim()}>
                    Send reply
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="help-empty-panel">
              <span className="dashboard-kicker">No case selected</span>
              <h3>{isAdmin ? 'No support cases in this filter.' : 'Open your first help case.'}</h3>
              <p className="dashboard-muted">Private support history will appear here.</p>
            </div>
          )}
        </section>

        {!isAdmin && (showNewCaseForm || cases.length === 0) && (
          <form className="premium-card help-new-case" onSubmit={handleCreateCase}>
            <span className="dashboard-kicker">Open a case</span>
            <h3>Tell admin what happened</h3>
            <label>
              Category
              <select className="premium-input" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Priority
              <select className="premium-input" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}>
                {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Subject
              <input
                className="premium-input"
                value={draft.subject}
                onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Example: I need help with a proposal"
              />
            </label>
            <label>
              Message
              <textarea
                className="premium-input"
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                placeholder="Write the details. Include job names, dates, and what outcome you need."
                rows={5}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Open private case
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
