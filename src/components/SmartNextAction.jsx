import React from 'react';
import { getSmartNextAction } from '../utils/lifecycleInsights';
import { useLanguage } from '../i18n/LanguageContext';

const actionLabelKeys = {
  'Respond to dispute': 'respondToDispute',
  'Work is done': 'workIsDone',
  'Propose visit date': 'proposeVisitDate',
  'Confirm or counter-propose appointment': 'confirmOrCounterAppointment',
  'Review appointment counter-proposal': 'reviewAppointmentCounter',
  'Mark work delivered': 'markWorkDelivered',
  'Confirm completion': 'confirmCompletion',
  'Leave review': 'leaveReview',
  'Download receipt': 'downloadReceipt',
  'Keep the workspace updated': 'keepWorkspaceUpdated',
};

const actionDetailKeys = {
  'Review sealed and reputation updated.': 'reviewSealedUpdated',
  'Completion confirmed and workspace closed.': 'completionConfirmedClosed',
};

export default function SmartNextAction(props) {
  const action = getSmartNextAction(props);
  const { t } = useLanguage();
  const isCompleted = action.tone === 'completed';
  const toneStyle = action.tone === 'risk'
    ? styles.risk
    : action.tone === 'primary'
    ? styles.primary
    : isCompleted
    ? styles.completed
    : styles.neutral;

  return (
    <div style={{ ...styles.container, ...toneStyle }}>
      <div style={styles.copyBlock}>
        <span style={{ ...styles.kicker, ...(isCompleted ? styles.completedKicker : {}) }}>
          {isCompleted ? t('completionStatus', 'Completion status') : t('nextAction', 'Next action')}
        </span>
        <strong style={{ ...styles.label, ...(isCompleted ? styles.completedLabel : {}) }}>
          {t(actionLabelKeys[action.label], action.label)}{isCompleted ? ' ✔' : ''}
        </strong>
        {action.detail && <span style={styles.detail}>{t(actionDetailKeys[action.detail], action.detail)}</span>}
      </div>
      {isCompleted && (
        <div style={styles.completedSeal} aria-hidden="true">
          <span style={styles.completedSealIcon}>✓</span>
          <span style={styles.completedSealText}>{t('closed', 'Closed')}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    borderRadius: 12,
    border: '1px solid var(--border)',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  copyBlock: {
    display: 'grid',
    gap: 5,
    minWidth: 0,
  },
  kicker: {
    color: 'var(--text-2)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  label: {
    color: 'var(--text)',
    fontSize: 14,
  },
  detail: {
    color: 'var(--text-2)',
    fontSize: 12,
    lineHeight: 1.45,
  },
  primary: {
    background: 'rgba(56, 189, 248, 0.09)',
    borderColor: 'rgba(56, 189, 248, 0.24)',
  },
  neutral: {
    background: 'rgba(148, 163, 184, 0.08)',
  },
  completed: {
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(245, 158, 11, 0.12))',
    borderColor: 'rgba(52, 211, 153, 0.34)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 48px rgba(16, 185, 129, 0.08)',
  },
  completedKicker: {
    color: '#6ee7b7',
  },
  completedLabel: {
    color: '#ecfdf5',
    fontSize: 16,
  },
  completedSeal: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: '8px 11px',
    background: 'rgba(6, 78, 59, 0.48)',
    border: '1px solid rgba(52, 211, 153, 0.35)',
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: 900,
  },
  completedSealIcon: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    borderRadius: 999,
    background: '#10b981',
    color: '#052e1f',
    fontSize: 12,
  },
  completedSealText: {
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  risk: {
    background: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
};
