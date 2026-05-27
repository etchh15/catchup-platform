import React, { useMemo } from 'react';
import { formatCurrency, formatDate, STATUS_BADGE_MAP } from '../utils/statusHelpers';

export default function AnalyticsLedger({ tasks = [], bids = [], user, role }) {
  // Derived metrics
  const metrics = useMemo(() => {
    const totalVolume = tasks
      .filter(t => t.budget)
      .reduce((sum, t) => sum + parseFloat(t.budget), 0);

    const openTasks = tasks.filter(t => t.status === 'open').length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const acceptedBids = bids.filter(b => b.status === 'accepted').length;
    const pendingBids = bids.filter(b => b.status === 'pending').length;

    return {
      totalVolume,
      openTasks,
      activeTasks,
      completedTasks,
      acceptedBids,
      pendingBids,
    };
  }, [tasks, bids]);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2>Insights</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Platform activity overview.</p>
      </div>

      <div className="stats-grid">
        {[
          {
            label: 'Total pipeline value',
            value: formatCurrency(metrics.totalVolume),
            sub: 'All open and active tasks',
          },
          {
            label: 'Open jobs',
            value: metrics.openTasks,
            sub: 'Accepting proposals now',
          },
          {
            label: 'Active contracts',
            value: metrics.activeTasks,
            sub: 'Work in progress',
          },
          {
            label: 'Proposals submitted',
            value: bids.length,
            sub: `${metrics.acceptedBids} accepted · ${metrics.pendingBids} pending`,
          },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="premium-card">
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 20,
          }}
        >
          All jobs
        </div>
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No tasks yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Job title', 'Client', 'District', 'Budget', 'Status'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        color: 'var(--text-3)',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td
                      style={{
                        padding: '13px 10px',
                        color: 'var(--text)',
                        fontWeight: 500,
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.title}
                    </td>
                    <td style={{ padding: '13px 10px', color: 'var(--text-2)' }}>{t.client_name || '—'}</td>
                    <td style={{ padding: '13px 10px', color: 'var(--text-2)' }}>{t.district_tag || '—'}</td>
                    <td
                      style={{
                        padding: '13px 10px',
                        color: 'var(--green)',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                      }}
                    >
                      {t.budget ? formatCurrency(t.budget) : '—'}
                    </td>
                    <td style={{ padding: '13px 10px' }}>
                      <span className={`badge ${STATUS_BADGE_MAP[t.status] || 'badge-muted'}`}>
                        {t.status || 'open'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
