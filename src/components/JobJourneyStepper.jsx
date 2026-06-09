import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const JOURNEY_STAGES = [
  { key: 'posted', label: 'Posted', labelKey: 'posted' },
  { key: 'proposals', label: 'Proposals', labelKey: 'proposals' },
  { key: 'accepted', label: 'Accepted', labelKey: 'accepted' },
  { key: 'scheduled', label: 'Scheduled', labelKey: 'scheduled' },
  { key: 'delivered', label: 'Delivered', labelKey: 'delivered' },
  { key: 'completed', label: 'Review & Complete', labelKey: 'reviewAndCompleteStep' },
];

function hasAccepted(task, agreement, room) {
  return Boolean(
    agreement?.id ||
    room?.id ||
    task?.agreement_id ||
    task?.specialist_id ||
    ['active', 'delivered', 'completed'].includes(task?.status)
  );
}

export function getJourneyState({
  task,
  bids = [],
  agreement,
  appointment,
  completion,
  review,
  room,
} = {}) {
  const bidCount = bids.length;
  const delivered = Boolean(completion?.workDeliveredAt || task?.work_delivered_at);
  const reviewed = Boolean(review?.id);
  const confirmed = Boolean(
    review?.id ||
    completion?.confirmedByClientAt ||
    task?.confirmed_by_client_at ||
    task?.status === 'completed' ||
    room?.status === 'completed'
  );
  const closed = Boolean(task?.status === 'completed' || room?.status === 'completed');

  const complete = {
    posted: Boolean(task?.id || task?.created_at),
    proposals: bidCount > 0 || hasAccepted(task, agreement, room),
    accepted: hasAccepted(task, agreement, room),
    scheduled: appointment?.status === 'confirmed' || delivered || confirmed || reviewed,
    delivered,
    completed: confirmed && (reviewed || closed),
  };

  let current = 'posted';
  if (!complete.posted) current = 'posted';
  else if (!complete.proposals) current = 'proposals';
  else if (!complete.accepted) current = 'accepted';
  else if (!complete.scheduled) current = 'scheduled';
  else if (!complete.delivered) current = 'delivered';
  else current = 'completed';

  return { complete, current, bidCount };
}

export default function JobJourneyStepper({ compact = false, ...stateProps }) {
  const { complete, current } = getJourneyState(stateProps);
  const currentIndex = JOURNEY_STAGES.findIndex((stage) => stage.key === current);
  const { t } = useLanguage();

  return (
    <div className={`job-journey ${compact ? 'compact' : ''}`} aria-label="Job journey">
      {JOURNEY_STAGES.map((stage, index) => {
        const isDone = complete[stage.key];
        const isCurrent = stage.key === current;
        return (
          <div
            key={stage.key}
            className={`job-journey-stage ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
          >
            <span className="job-journey-dot">{isDone ? '✓' : index + 1}</span>
            <span className="job-journey-label">{t(stage.labelKey, stage.label)}</span>
            {index < JOURNEY_STAGES.length - 1 && (
              <span className={`job-journey-line ${index < currentIndex ? 'done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
