import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const clientSteps = [
  'Post request',
  'Compare quotes',
  'Accept match',
  'Coordinate visit',
  'Confirm delivery',
  'Review & complete',
];

const specialistSteps = [
  'Find work',
  'Send quote',
  'Win match',
  'Plan visit',
  'Deliver work',
  'Build reputation',
];

const contextCopy = {
  dashboard: 'Your active work moves through a protected service journey from request to receipt.',
  marketplace: 'Browse, quote, and accept work with trust signals visible before anyone commits.',
  workspace: 'This deal room keeps scheduling, delivery, messages, reviews, and receipts connected.',
  profile: 'Your storefront and reputation decide how confidently people choose to work with you.',
  insights: 'Pipeline health follows the same journey: demand, quotes, active work, completion, and trust.',
};

export default function CatchUpServiceFlow({ role = 'client', context = 'dashboard', activeIndex = 0 }) {
  const { t } = useLanguage();
  const steps = role === 'specialist' ? specialistSteps : clientSteps;
  const stepKeys = role === 'specialist'
    ? ['findWork', 'sendQuote', 'winMatch', 'planVisit', 'deliverWork', 'buildReputation']
    : ['postRequest', 'compareQuotes', 'acceptMatch', 'coordinateVisit', 'confirmDelivery', 'reviewAndComplete'];
  const safeActiveIndex = Math.max(0, Math.min(activeIndex, steps.length - 1));

  return (
    <section className={`service-flow-ribbon service-flow-${context}`} aria-label="CatchUp service flow">
      <div className="service-flow-copy">
        <span className="dashboard-kicker">{t('catchupServiceFlow', 'CatchUp service flow')}</span>
        <strong>{t(`flow${context.charAt(0).toUpperCase()}${context.slice(1)}`, contextCopy[context] || contextCopy.dashboard)}</strong>
      </div>
      <div className="service-flow-steps">
        {steps.map((step, index) => (
          <span
            key={step}
            className={`service-flow-step ${index < safeActiveIndex ? 'done' : ''} ${index === safeActiveIndex ? 'active' : ''}`}
          >
            <em>{index + 1}</em>
            {t(stepKeys[index], step)}
          </span>
        ))}
      </div>
    </section>
  );
}
