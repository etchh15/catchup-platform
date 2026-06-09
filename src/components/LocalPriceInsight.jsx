import React from 'react';
import { formatCurrency, normalizeEgyptMarket } from '../utils/statusHelpers';

export default function LocalPriceInsight({ insight, amount }) {
  if (!insight || !insight.category || !insight.district) return null;

  const hasRange = insight.low !== null && insight.high !== null;
  const hasBudgetRange = insight.budgetLow !== null && insight.budgetHigh !== null;
  const amountLabel = amount ? buildComparisonLabel(insight) : null;
  const marketLabel = normalizeEgyptMarket(insight.district);

  return (
    <div style={styles.container}>
      <div style={styles.title}>Local price intelligence</div>
      <div style={styles.body}>
        {hasRange ? (
          <>
            Typical {insight.acceptedCount ? 'accepted' : 'bid'} range in {marketLabel} for {insight.category}:{' '}
            <strong>{formatCurrency(insight.low)}-{formatCurrency(insight.high)}</strong>
          </>
        ) : hasBudgetRange ? (
          <>
            Posted budgets in {marketLabel} for {insight.category} usually land around{' '}
            <strong>{formatCurrency(insight.budgetLow)}-{formatCurrency(insight.budgetHigh)}</strong>
          </>
        ) : (
          <>Limited data for this category yet.</>
        )}
      </div>
      <div style={styles.meta}>
        {insight.comparableJobs} comparable job{insight.comparableJobs === 1 ? '' : 's'} · {insight.comparableBids} proposal
        {insight.comparableBids === 1 ? '' : 's'}
        {insight.limited ? ' · limited sample' : ''}
      </div>
      {amountLabel && <div style={styles.signal}>{amountLabel}</div>}
    </div>
  );
}

function buildComparisonLabel(insight) {
  if (insight.comparison === 'below') return 'Your price is below the local accepted average.';
  if (insight.comparison === 'above') return 'Your price is above the local accepted average.';
  if (insight.comparison === 'near') return 'Your price is close to the local accepted average.';
  return null;
}

const styles = {
  container: {
    background: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid rgba(34, 197, 94, 0.18)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  title: {
    color: 'var(--green)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 4,
  },
  body: {
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.45,
  },
  meta: {
    color: 'var(--text-3)',
    fontSize: 11,
    marginTop: 6,
  },
  signal: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: 650,
    marginTop: 8,
  },
};
