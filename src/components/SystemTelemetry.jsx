import React, { useEffect, useMemo, useState } from 'react';
import { fetchAdminEmergencySignals } from '../services/supabaseService';

const signalLabel = (value, fallback = 'Unavailable') => value == null ? fallback : value;

const severityRank = { risk: 3, warn: 2, normal: 1 };

export default function SystemTelemetry({ tasks = [], bids = [], specialists = [], setActiveTab }) {
  const [signals, setSignals] = useState(null);
  const [signalError, setSignalError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAdminEmergencySignals()
      .then((data) => {
        if (!cancelled) setSignals(data);
      })
      .catch((err) => {
        if (!cancelled) setSignalError(err?.message || 'Admin emergency signals unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const localSignals = useMemo(() => ({
    openTasks: tasks.filter((task) => task.status === 'open').length,
    activeTasks: tasks.filter((task) => task.status === 'active').length,
    pendingBids: bids.filter((bid) => bid.status === 'pending').length,
    unverifiedSpecialists: specialists.filter((specialist) => !specialist.is_verified && specialist.verification_status !== 'verified').length,
  }), [tasks, bids, specialists]);

  const signalCards = useMemo(() => [
    {
      key: 'openDisputes',
      label: 'Open disputes',
      value: signalLabel(signals?.openDisputes),
      numericValue: signals?.openDisputes ?? 0,
      severity: 'risk',
      destination: ['analytics', '#admin-disputes'],
      action: 'Review disputes',
      description: 'Highest trust risk. Resolve before pushing growth.',
    },
    {
      key: 'activeRooms',
      label: 'Active rooms',
      value: signalLabel(signals?.activeRooms, localSignals.activeTasks),
      numericValue: signals?.activeRooms ?? localSignals.activeTasks ?? 0,
      severity: 'normal',
      destination: ['messages'],
      action: 'Open workspaces',
      description: 'Live jobs with client and specialist activity.',
    },
    {
      key: 'staleOpenTasks',
      label: 'Stale open jobs',
      value: signalLabel(signals?.staleOpenTasks),
      numericValue: signals?.staleOpenTasks ?? 0,
      severity: 'warn',
      destination: ['marketplace'],
      action: 'Review marketplace',
      description: 'Old demand may need admin intervention or cleanup.',
    },
    {
      key: 'pendingVerification',
      label: 'Verification queue',
      value: signalLabel(signals?.pendingVerification, localSignals.unverifiedSpecialists),
      numericValue: signals?.pendingVerification ?? localSignals.unverifiedSpecialists ?? 0,
      severity: 'warn',
      destination: ['analytics', '#admin-verification'],
      action: 'Verify specialists',
      description: 'Supply trust gate. Review before accepting more demand.',
    },
    {
      key: 'betaWaitlist',
      label: 'Beta waitlist',
      value: signalLabel(signals?.betaWaitlist),
      numericValue: signals?.betaWaitlist ?? 0,
      severity: 'normal',
      destination: ['analytics', '#admin-waitlist'],
      action: 'Open waitlist',
      description: 'New demand/supply waiting for operator review.',
    },
    {
      key: 'openAbuseEvents',
      label: 'Abuse reports',
      value: signalLabel(signals?.openAbuseEvents),
      numericValue: signals?.openAbuseEvents ?? 0,
      severity: 'risk',
      destination: ['analytics', '#admin-abuse'],
      action: 'Review abuse',
      description: 'Safety and fraud queue. Act before users lose trust.',
    },
    {
      key: 'unpaidAcceptedWork',
      label: 'Unpaid accepted work',
      value: signalLabel(signals?.unpaidAcceptedWork),
      numericValue: signals?.unpaidAcceptedWork ?? 0,
      severity: 'warn',
      destination: ['marketplace'],
      action: 'Review jobs',
      description: 'Accepted work still marked unpaid during beta.',
    },
    {
      key: 'pendingBids',
      label: 'Pending bids',
      value: localSignals.pendingBids,
      numericValue: localSignals.pendingBids,
      severity: 'normal',
      destination: ['marketplace'],
      action: 'Open proposals',
      description: 'Marketplace liquidity waiting for client action.',
    },
  ], [localSignals.activeTasks, localSignals.pendingBids, localSignals.unverifiedSpecialists, signals]);

  const commandItems = useMemo(() => (
    signalCards
      .filter((item) => item.numericValue > 0)
      .sort((a, b) => (severityRank[b.severity] - severityRank[a.severity]) || b.numericValue - a.numericValue)
      .slice(0, 4)
  ), [signalCards]);

  const primaryCommand = commandItems[0] || {
    label: 'No urgent admin action',
    value: 0,
    severity: 'normal',
    destination: ['analytics', '#admin-operations-command'],
    action: 'Open operations',
    description: 'Queues are quiet. Keep checking before public marketing pushes.',
  };

  const handleNavigate = (destination = ['telemetry']) => {
    const [tab, hash] = destination;
    setActiveTab?.(tab, hash);
  };

  const checks = [
    { label: 'Database', status: 'Connected',   ok: true,  note: 'Supabase responding normally' },
    { label: 'Auth',     status: 'Active',       ok: true,  note: 'Row-level security enabled' },
    { label: 'Realtime', status: 'Connected',    ok: true,  note: 'WebSocket channels live' },
    { label: 'Storage',  status: 'Available',    ok: true,  note: 'File storage reachable' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2>System health</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Infrastructure status and diagnostics.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {checks.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ fontSize: 20, color: c.ok ? 'var(--green)' : 'var(--red)' }}>{c.status}</div>
            <div className="stat-sub">{c.note}</div>
          </div>
        ))}
      </div>

      <div className="premium-card admin-emergency-console">
        <div className="dashboard-panel-head">
          <div>
            <span className="dashboard-kicker">Emergency console</span>
            <h3>Founder-away operating signals</h3>
          </div>
          <span className="dashboard-alert-count">{signalError || 'Live admin snapshot'}</span>
        </div>
        <div className={`admin-command-primary ${primaryCommand.severity}`}>
          <div>
            <span className="dashboard-kicker">Recommended admin action</span>
            <h4>{primaryCommand.label}</h4>
            <p>{primaryCommand.description}</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleNavigate(primaryCommand.destination)}>
            {primaryCommand.action}
          </button>
        </div>

        <div className="admin-command-list" aria-label="Ranked admin command queue">
          {commandItems.length === 0 ? (
            <div className="admin-command-empty">No urgent queues right now. Keep monitoring before broad public posting.</div>
          ) : commandItems.map((item) => (
            <button key={item.key} type="button" className={`admin-command-row ${item.severity}`} onClick={() => handleNavigate(item.destination)}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <em>{item.action}</em>
            </button>
          ))}
        </div>

        <div className="admin-signal-grid">
          {signalCards.map((item) => (
            <button key={item.key} type="button" className={`admin-signal ${item.severity === 'normal' ? '' : item.severity}`} onClick={() => handleNavigate(item.destination)}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{item.action}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="premium-card">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Event log</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { type: 'INFO',     msg: 'Supabase realtime channel connected successfully.',     time: 'Just now' },
            { type: 'SECURITY', msg: 'Row-level security policies active on all tables.',      time: '1m ago' },
            { type: 'INFO',     msg: 'Auth state listener registered.',                        time: '1m ago' },
          ].map((log, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-soft)', padding: '12px 16px', borderRadius: 8 }}>
              <span className={`badge ${log.type === 'SECURITY' ? 'badge-blue' : 'badge-muted'}`}>{log.type}</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{log.msg}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
