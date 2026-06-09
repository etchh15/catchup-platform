import React from 'react';
import { buildTrustTimeline } from '../utils/lifecycleInsights';
import { useLanguage } from '../i18n/LanguageContext';

const timelineLabelKeys = {
  'Job posted': 'jobPosted',
  'Proposal accepted': 'proposalAccepted',
  'Agreement created': 'agreementCreated',
  'Visit proposed': 'visitProposed',
  'Visit scheduled': 'visitScheduled',
  'Work delivered': 'workDelivered',
  'Client confirmed': 'clientConfirmed',
  'Receipt ready': 'receiptReady',
  'Receipt generated': 'receiptGenerated',
  'Dispute resolved': 'disputeResolved',
  'Dispute opened': 'disputeOpened',
};

export default function TrustTimeline(props) {
  const steps = buildTrustTimeline(props);
  const { t } = useLanguage();

  return (
    <div style={styles.container}>
      <div style={styles.header}>{t('trustTimeline', 'Trust timeline')}</div>
      <div style={styles.steps}>
        {steps.map((step) => (
          <div key={step.key} style={styles.step}>
            <span
              style={{
                ...styles.dot,
                ...(step.tone === 'risk'
                  ? styles.riskDot
                  : step.state === 'completed'
                  ? styles.doneDot
                  : step.state === 'current'
                  ? styles.currentDot
                  : styles.pendingDot),
              }}
            />
            <div style={styles.copy}>
              <div style={{ ...styles.label, color: step.state === 'pending' ? 'var(--text-3)' : 'var(--text)' }}>
                {t(timelineLabelKeys[step.label], step.label)}
              </div>
              <div style={styles.meta}>
                {step.date
                  ? new Date(step.date).toLocaleDateString()
                  : step.state === 'completed'
                  ? t('done', 'Done')
                  : step.state === 'pending'
                  ? t('pending', 'Pending')
                  : t('inProgress', 'In progress')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--bg-soft)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 14,
  },
  header: {
    color: 'var(--text-2)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 12,
  },
  steps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginTop: 4,
    flexShrink: 0,
  },
  doneDot: {
    background: 'var(--green)',
    boxShadow: '0 0 0 3px rgba(34,197,94,0.12)',
  },
  currentDot: {
    background: 'var(--gold)',
    boxShadow: '0 0 0 3px rgba(234,179,8,0.14)',
  },
  pendingDot: {
    background: '#475569',
  },
  riskDot: {
    background: 'var(--red)',
    boxShadow: '0 0 0 3px rgba(239,68,68,0.14)',
  },
  copy: {
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 650,
    lineHeight: 1.3,
  },
  meta: {
    color: 'var(--text-3)',
    fontSize: 11,
    marginTop: 2,
  },
};
