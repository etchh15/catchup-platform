import React, { useState } from 'react';

export default function MilestoneChecklist({ milestones, isSpecialist, isClient, onMilestoneComplete, loading }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!milestones || milestones.length === 0) {
    return null;
  }

  const handleComplete = async (milestone) => {
    try {
      await onMilestoneComplete(milestone.id);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const MILESTONE_ICONS = {
    1: '📝',
    2: '📅',
    3: '🔨',
    4: '👁️',
    5: '✅',
  };

  const progress = Math.round((milestones.filter((m) => m.status === 'completed').length / milestones.length) * 100);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📊 Progress</h3>
        <span style={styles.progress}>{progress}% Complete</span>
      </div>

      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
      </div>

      <div style={styles.milestonesList}>
        {milestones.map((milestone) => (
          <div key={milestone.id} style={styles.milestoneCard}>
            <div
              style={styles.milestoneHeader}
              onClick={() => setExpandedId(expandedId === milestone.id ? null : milestone.id)}
            >
              <div style={styles.milestoneTitle}>
                <span style={styles.icon}>
                  {milestone.status === 'completed' ? '✓' : MILESTONE_ICONS[milestone.milestone_number]}
                </span>
                <div>
                  <div style={styles.milestoneName}>{milestone.name}</div>
                  {milestone.description && (
                    <div style={styles.description}>{milestone.description}</div>
                  )}
                </div>
              </div>
              <div
                style={{
                  ...styles.status,
                  ...(milestone.status === 'completed' ? styles.statusDone : styles.statusPending),
                }}
              >
                {milestone.status === 'completed' ? '✓ Done' : 'Pending'}
              </div>
            </div>

            {expandedId === milestone.id && (
              <div style={styles.expandedContent}>
                {milestone.completed_at && (
                  <div style={styles.detail}>
                    <span style={styles.detailLabel}>Completed:</span>
                    <span style={styles.detailValue}>
                      {new Date(milestone.completed_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}

                {milestone.notes && (
                  <div style={styles.detail}>
                    <span style={styles.detailLabel}>Notes:</span>
                    <span style={styles.detailValue}>{milestone.notes}</span>
                  </div>
                )}

                {milestone.status === 'pending' && milestone.milestone_number === 3 && isSpecialist && (
                  <button
                    onClick={() => handleComplete(milestone)}
                    disabled={loading}
                    style={styles.completeBtn}
                  >
                    Mark Work Started
                  </button>
                )}

                {milestone.status === 'pending' && milestone.milestone_number === 4 && isClient && (
                  <button
                    onClick={() => handleComplete(milestone)}
                    disabled={loading}
                    style={styles.completeBtn}
                  >
                    Mark as Inspected
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600',
  },
  progress: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--green)',
    background: '#f0fdf4',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  progressBar: {
    height: '8px',
    background: 'var(--bg-soft)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  progressFill: {
    height: '100%',
    background: 'var(--green)',
    transition: 'width 0.3s ease',
  },
  milestonesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  milestoneCard: {
    border: '1px solid var(--border)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  milestoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'var(--bg-soft)',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  milestoneTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  icon: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  milestoneName: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  description: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  status: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  statusDone: {
    background: '#d1fae5',
    color: var(--green),
  },
  statusPending: {
    background: '#fef3c7',
    color: '#92400e',
  },
  expandedContent: {
    padding: '12px',
    background: 'white',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detail: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  detailLabel: {
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  detailValue: {
    color: 'var(--text)',
  },
  completeBtn: {
    padding: '10px 16px',
    background: 'var(--green)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};
