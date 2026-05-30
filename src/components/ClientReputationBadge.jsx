import React from 'react';

export default function ClientReputationBadge({ reputation, compact = false }) {
  if (!reputation) {
    return null;
  }

  const getCompletionColor = (rate) => {
    if (rate >= 80) return '#22c55e';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const stats = [
    {
      label: 'Jobs Posted',
      value: reputation.total_jobs_posted,
      icon: '📋',
    },
    {
      label: 'Completion Rate',
      value: `${reputation.completion_rate}%`,
      icon: '✓',
      color: getCompletionColor(reputation.completion_rate),
    },
    {
      label: 'Rating',
      value: reputation.average_rating_from_specialists > 0 
        ? `${reputation.average_rating_from_specialists.toFixed(1)} ⭐` 
        : 'No ratings yet',
      icon: '⭐',
    },
    {
      label: 'Verified',
      value: reputation.phone_verified && reputation.email_verified ? 'Yes' : 'Partial',
      icon: '✓',
    },
  ];

  if (compact) {
    return (
      <div style={styles.compactContainer}>
        <div style={{ ...styles.compactItem, borderColor: getCompletionColor(reputation.completion_rate) }}>
          <span style={styles.compactLabel}>Completion</span>
          <span style={styles.compactValue}>{reputation.completion_rate}%</span>
        </div>
        <div style={styles.compactItem}>
          <span style={styles.compactLabel}>Rating</span>
          <span style={styles.compactValue}>
            {reputation.average_rating_from_specialists > 0
              ? `${reputation.average_rating_from_specialists.toFixed(1)} ⭐`
              : 'New'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>👤 Client Profile</h4>

      <div style={styles.statsGrid}>
        {stats.map((stat, i) => (
          <div key={i} style={styles.statCard}>
            <span style={styles.statIcon}>{stat.icon}</span>
            <div style={styles.statContent}>
              <div style={styles.statLabel}>{stat.label}</div>
              <div
                style={{
                  ...styles.statValue,
                  ...(stat.color ? { color: stat.color } : {}),
                }}
              >
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.badges}>
        {reputation.phone_verified && (
          <span style={styles.badge}>✓ Phone Verified</span>
        )}
        {reputation.email_verified && (
          <span style={styles.badge}>✓ Email Verified</span>
        )}
        {reputation.total_jobs_completed > 10 && (
          <span style={styles.badge}>⭐ Top Client</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'white',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '12px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    background: 'var(--bg-soft)',
    borderRadius: '6px',
  },
  statIcon: {
    fontSize: '18px',
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  statValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '600',
    background: '#d1fae5',
    color: '#065f46',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  compactContainer: {
    display: 'flex',
    gap: '8px',
  },
  compactItem: {
    flex: 1,
    padding: '8px',
    border: '2px solid',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  compactLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  compactValue: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text)',
  },
};
