import React, { useState } from 'react';
import { useAdminDisputes } from '../hooks/useAdminDisputes';
import { formatDate, formatCurrency } from '../utils/statusHelpers';
import { useToast } from './Toast';

export default function AdminDisputeQueue() {
  const toast = useToast();
  const { disputes, loading, error, resolve } = useAdminDisputes();
  const [activeDispute, setActiveDispute] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('Admin reviewed the dispute and closed the case.');
  const [amount, setAmount] = useState('0.00');
  const [busy, setBusy] = useState(false);

  const handleSelect = (dispute) => {
    setActiveDispute(dispute);
    setResolutionNote('Admin reviewed the dispute and closed the case.');
    setAmount('0.00');
  };

  const handleResolve = async () => {
    if (!activeDispute) return;
    setBusy(true);
    try {
      await resolve(activeDispute.id, resolutionNote, parseFloat(amount) || 0);
      toast('Dispute resolved successfully. Participants have been notified.', 'success');
      setActiveDispute(null);
      setResolutionNote('Admin reviewed the dispute and closed the case.');
      setAmount('0.00');
    } catch (err) {
      toast(`Unable to resolve dispute: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
        <div>
          <h2>Admin Dispute Queue</h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
            Review open disputes and resolve cases end-to-end.
          </p>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {loading ? 'Loading disputes…' : `${disputes.length} open case${disputes.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 16, background: '#fee8e8', color: '#a11', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {disputes.length === 0 && !loading ? (
        <div style={{ padding: 16, background: 'var(--bg-muted)', borderRadius: 8 }}>
          No open disputes currently.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {disputes.map((dispute) => (
            <button
              key={dispute.id}
              type="button"
              onClick={() => handleSelect(dispute)}
              style={{
                textAlign: 'left',
                padding: 16,
                borderRadius: 12,
                border: activeDispute?.id === dispute.id ? '2px solid var(--blue)' : '1px solid var(--border)',
                background: activeDispute?.id === dispute.id ? 'var(--blue-dim)' : 'var(--bg)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{dispute.tasks?.title || 'Untitled task'}</div>
                <div style={{ color: 'var(--text-3)' }}>{formatDate(dispute.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-2)' }}>Filed by: {dispute.filed_by}</span>
                <span style={{ color: 'var(--text-2)' }}>Status: {dispute.status}</span>
                <span style={{ color: 'var(--green)' }}>{dispute.tasks?.budget != null ? formatCurrency(dispute.tasks.budget) : 'No budget'}</span>
              </div>
              <p style={{ margin: '12px 0 0', color: 'var(--text-2)', fontSize: 14 }}>{dispute.reason}</p>
            </button>
          ))}
        </div>
      )}

      {activeDispute && (
        <div style={{ marginTop: 28, padding: 20, borderRadius: 12, background: 'var(--bg-muted)' }}>
          <h3 style={{ margin: '0 0 12px' }}>Resolve dispute</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px' }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Resolution note</label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={4}
                style={{ width: '100%', minWidth: 0, padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ minWidth: 220 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Settlement amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy}
              onClick={handleResolve}
              style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer' }}
            >
              {busy ? 'Resolving…' : 'Resolve dispute'}
            </button>
            <button
              type="button"
              onClick={() => setActiveDispute(null)}
              style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
