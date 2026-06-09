import React, { useState, useOptimistic, useCallback } from 'react';
import { useToast } from './Toast';

export default function MilestoneChecklist({ milestones, isSpecialist, isClient, onMilestoneComplete, loading }) {
  const toast = useToast();
  const [expandedId, setExpandedId] = useState(null);

  // Optimistic state: immediately mark milestone as completed in UI
  const [optimisticMilestones, updateOptimisticMilestone] = useOptimistic(
    milestones,
    (state, milestoneId) =>
      state.map((m) =>
        m.id === milestoneId
          ? { ...m, status: 'completed', completed_at: new Date().toISOString() }
          : m
      )
  );

  const [completingId, setCompletingId] = useState(null);

  const handleComplete = useCallback(
    async (milestone) => {
      // 1. Optimistic UI: mark as completed immediately
      updateOptimisticMilestone(milestone.id);
      setCompletingId(milestone.id);

      try {
        // 2. Save to backend in background
        await onMilestoneComplete(milestone.id);
        toast('Milestone updated.', 'success');
      } catch (err) {
        // On error, revert (optimisticMilestones will fall back to original)
        setCompletingId(null);
        console.error('❌ Error completing milestone:', err);
        toast('Failed to complete milestone', 'error');
      } finally {
        setCompletingId(null);
      }
    },
    [updateOptimisticMilestone, onMilestoneComplete, toast]
  );

  const MILESTONE_ICONS = {
    1: '📝',
    2: '📅',
    3: '🔨',
    4: '👁️',
    5: '✅',
  };

  if (!optimisticMilestones || optimisticMilestones.length === 0) {
    return null;
  }

  const progress = Math.round((optimisticMilestones.filter((m) => m.status === 'completed').length / optimisticMilestones.length) * 100);

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
        {optimisticMilestones.map((milestone) => (
          <div key={milestone.id} style={styles.milestoneCard}>
            <div
              style={styles.milestoneHeader}
              onClick={() => setExpandedId(expandedId === milestone.id ? null : milestone.id)}
            >
              <div style={styles.milestoneTitle}>
                <span style={styles.icon}>
                  {milestone.status === 'completed' ? '✅' : MILESTONE_ICONS[milestone.milestone_number]}
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
                {milestone.status === 'completed' ? '✓ Done' : completingId === milestone.id ? '⏳ Saving…' : 'Pending'}
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
                    disabled={loading || completingId === milestone.id}
                    style={styles.completeBtn}
                  >
                    {completingId === milestone.id ? '⏳ Marking…' : '✓ Mark Work Started'}
                  </button>
                )}

                {milestone.status === 'pending' && milestone.milestone_number === 4 && isClient && (
                  <button
                    onClick={() => handleComplete(milestone)}
                    disabled={loading || completingId === milestone.id}
                    style={styles.completeBtn}
                  >
                    {completingId === milestone.id ? '⏳ Marking…' : '✓ Mark as Inspected'}
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
    background: 'rgba(8, 12, 20, 0.28)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: 0,
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
    color: 'var(--text)',
  },
  progress: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--green)',
    background: 'var(--green-dim)',
    padding: '4px 8px',
    borderRadius: '999px',
  },
  progressBar: {
    height: '8px',
    background: 'var(--bg-soft)',
    borderRadius: '999px',
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
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  milestoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(13, 18, 32, 0.72)',
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
    color: 'var(--text-2)',
    marginTop: '2px',
  },
  status: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '999px',
  },
  statusDone: {
    background: 'var(--green-dim)',
    color: 'var(--green)',
  },
  statusPending: {
    background: 'var(--gold-dim)',
    color: 'var(--gold-light)',
  },
  expandedContent: {
    padding: '12px',
    background: 'rgba(8, 12, 20, 0.46)',
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
    color: 'var(--text-2)',
  },
  detailValue: {
    color: 'var(--text)',
  },
  completeBtn: {
    padding: '10px 16px',
    background: 'var(--green)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};
