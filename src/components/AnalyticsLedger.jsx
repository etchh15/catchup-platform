import React, { useMemo } from 'react';
import { formatCurrency, STATUS_BADGE_MAP } from '../utils/statusHelpers';
import AdminDisputeQueue from './AdminDisputeQueue';
import CatchUpServiceFlow from './CatchUpServiceFlow';
import { useLanguage } from '../i18n/LanguageContext';
import AdminBetaOperations from './AdminBetaOperations';

export default function AnalyticsLedger({ tasks = [], bids = [], role }) {
  const { t } = useLanguage();
  // Derived metrics
  const metrics = useMemo(() => {
    const totalVolume = tasks
      .filter(t => (t.status === 'open' || t.status === 'active'))
      .filter(t => t.budget !== null && t.budget !== undefined)
      .reduce((sum, t) => sum + parseFloat(t.budget), 0);

    const openTasks = tasks.filter(t => t.status === 'open').length;
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const acceptedBids = bids.filter(b => b.status === 'accepted').length;
    const pendingBids = bids.filter(b => b.status === 'pending').length;
    const disputedTasks = tasks.filter(t => t.status === 'disputed').length;
    const staleOpenTasks = tasks.filter(t => {
      if (t.status !== 'open' || !t.created_at) return false;
      return Date.now() - new Date(t.created_at).getTime() > 24 * 60 * 60 * 1000;
    }).length;

    return {
      totalVolume,
      openTasks,
      activeTasks,
      completedTasks,
      acceptedBids,
      pendingBids,
      disputedTasks,
      staleOpenTasks,
    };
  }, [tasks, bids]);

  return (
    <div>
      {role === 'admin' && (
        <>
          <AdminBetaOperations />
          <AdminDisputeQueue />
        </>
      )}
      <div className="insights-hero-panel">
        <span className="dashboard-kicker">Admin only</span>
        <h2>{t('insightsTitle', 'Platform operations')}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{t('insightsIntro', 'Admin tools for monitoring demand, quotes, disputes, and closeout health.')}</p>
        <CatchUpServiceFlow role={role} context="insights" activeIndex={2} />
      </div>

      {role === 'admin' && (
        <div className="admin-ops-grid">
          <section className="premium-card">
            <div className="dashboard-panel-head">
              <span className="dashboard-kicker">Operator queue</span>
              <span className="dashboard-alert-count">{metrics.disputedTasks + metrics.staleOpenTasks}</span>
            </div>
            <div className="admin-ops-list">
              <div>
                <strong>{metrics.disputedTasks}</strong>
                <span>Disputed jobs need admin review</span>
              </div>
              <div>
                <strong>{metrics.staleOpenTasks}</strong>
                <span>Open jobs older than 24h need marketplace attention</span>
              </div>
              <div>
                <strong>{metrics.activeTasks}</strong>
                <span>Active workspaces should keep chat, receipt, delivery, and review wired</span>
              </div>
            </div>
          </section>

          <section className="premium-card">
            <div className="dashboard-panel-head">
              <span className="dashboard-kicker">VS Code control map</span>
              <span className="dashboard-alert-count">Runbook</span>
            </div>
            <div className="admin-runbook">
              <code>src/services/supabaseService.js</code>
              <span>Supabase RPCs, reviews, receipts, disputes, and workspace writes.</span>
              <code>src/components/ProjectRoom.jsx</code>
              <span>Chat, completion, review closeout, receipt, and dispute UX.</span>
              <code>supabase/migrations/</code>
              <span>Production database changes. Add safe migrations here before deploy.</span>
              <code>npm run scan:safety && npm test -- --run && npm run build</code>
              <span>Required quality gate before shipping marketplace fixes.</span>
            </div>
          </section>
        </div>
      )}

      <div className="stats-grid">
        {[
          {
            label: 'Total pipeline value',
            value: formatCurrency(metrics.totalVolume),
            sub: 'Open and active tasks',
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
                      {t.budget !== null && t.budget !== undefined ? formatCurrency(t.budget) : '—'}
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
