import React from 'react';

export default function AnalyticsLedger({ tasks = [], bids = [], user, role }) {
  // 📊 COMPUTE ARCHITECTURAL ECOSYSTEM METRICS
  const totalTasksPosted = tasks.length;
  
  // Calculate total transactional volume running through the user's scope
  const totalFinancialVolume = tasks
    .filter(t => t.budget)
    .reduce((sum, t) => sum + parseFloat(t.budget), 0);

  // Compute bid density parameter metrics
  const totalBidsRegistered = bids.length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', fontFamily: 'sans-serif' }}>
      
      {/* 📈 COMPONENT SECTION TITLE */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px' }}>
          Operational Intelligence Matrix
        </h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Real-time performance analytics tracking volume, transaction density, and fulfillment statistics.
        </p>
      </div>

      {/* 📊 THE TRIPLE METRIC BANNER GRID (Airbnb Operations Standard) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '40px' }}>
        
        {/* Metric Block One: Financial Value Accumulation */}
        <div className="premium-card" style={{ margin: 0, padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Pipeline Financial Volume
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#10b981', letterSpacing: '-1px' }}>
            {totalFinancialVolume.toLocaleString()} <span style={{ fontSize: '16px', fontWeight: '500', color: '#64748b' }}>EGP</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
            Cumulative valuation allocation of open and active board assignments.
          </div>
        </div>

        {/* Metric Block Two: Task Operational Velocity */}
        <div className="premium-card" style={{ margin: 0, padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Ecosystem Order Velocity
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#38bdf8', letterSpacing: '-1px' }}>
            {totalTasksPosted} <span style={{ fontSize: '16px', fontWeight: '500', color: '#64748b' }}>Active</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
            Total global volume of broadcasted requirements across regional nodes.
          </div>
        </div>

        {/* Metric Block Three: Conversion Ratio Metrics */}
        <div className="premium-card" style={{ margin: 0, padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Proposal Match Conversion
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#6366f1', letterSpacing: '-1px' }}>
            {totalBidsRegistered} <span style={{ fontSize: '16px', fontWeight: '500', color: '#64748b' }}>Offers</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
            Accumulated bid submissions representing localized provider interaction depth.
          </div>
        </div>

      </div>

      {/* 📋 DENSE OPERATIONAL TRANSACTION RECORD LEDGER TABLE */}
      <div className="premium-card" style={{ padding: '32px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700' }}>Active Marketplace Auditing Record</h3>
        
        {tasks.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No historical ledger entries available to build data columns.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 8px', fontWeight: '600' }}>Assignment Target ID</th>
                  <th style={{ padding: '12px 8px', fontWeight: '600' }}>Owner Reference</th>
                  <th style={{ padding: '12px 8px', fontWeight: '600' }}>Regional Scope</th>
                  <th style={{ padding: '12px 8px', fontWeight: '600' }}>Financial Valuation</th>
                  <th style={{ padding: '12px 8px', fontWeight: '600' }}>Operational State</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', color: '#cbd5e1' }}>
                    <td style={{ padding: '16px 8px', fontWeight: '500', color: '#f8fafc' }}>{task.title}</td>
                    <td style={{ padding: '16px 8px' }}>{task.client_name || 'Khaled Wafa'}</td>
                    <td style={{ padding: '16px 8px' }}>{task.district_tag || 'Tala'}</td>
                    <td style={{ padding: '16px 8px', color: '#10b981', fontWeight: '600' }}>{task.budget} EGP</td>
                    <td style={{ padding: '16px 8px' }}>
                      <span style={{
                        background: task.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : task.status === 'active' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                        color: task.status === 'completed' ? '#10b981' : task.status === 'active' ? '#38bdf8' : '#eab308',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase'
                      }}>
                        {task.status || 'Open'}
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
