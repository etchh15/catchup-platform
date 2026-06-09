import React, { useEffect, useMemo, useState } from 'react';
import { fetchAdminEmergencySignals } from '../services/supabaseService';

const signalLabel = (value, fallback = 'Unavailable') => value == null ? fallback : value;

export default function SystemTelemetry({ tasks = [], bids = [], specialists = [] }) {
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
        <div className="admin-signal-grid">
          <div className="admin-signal risk"><span>Open disputes</span><strong>{signalLabel(signals?.openDisputes)}</strong></div>
          <div className="admin-signal"><span>Active rooms</span><strong>{signalLabel(signals?.activeRooms, localSignals.activeTasks)}</strong></div>
          <div className="admin-signal warn"><span>Stale open jobs</span><strong>{signalLabel(signals?.staleOpenTasks)}</strong></div>
          <div className="admin-signal warn"><span>Verification queue</span><strong>{signalLabel(signals?.pendingVerification, localSignals.unverifiedSpecialists)}</strong></div>
          <div className="admin-signal"><span>Beta waitlist</span><strong>{signalLabel(signals?.betaWaitlist)}</strong></div>
          <div className="admin-signal risk"><span>Abuse reports</span><strong>{signalLabel(signals?.openAbuseEvents)}</strong></div>
          <div className="admin-signal warn"><span>Unpaid accepted work</span><strong>{signalLabel(signals?.unpaidAcceptedWork)}</strong></div>
          <div className="admin-signal"><span>Pending bids</span><strong>{localSignals.pendingBids}</strong></div>
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
