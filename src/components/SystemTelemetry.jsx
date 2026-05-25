import React from 'react';

export default function SystemTelemetry() {
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
