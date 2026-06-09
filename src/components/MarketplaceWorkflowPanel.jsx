import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const sameId = (left, right) => left != null && right != null && String(left) === String(right);

export function buildMarketplaceWorkflow({ user, role, tasks = [], bids = [], notifications = [] } = {}) {
  const myTasks = role === 'client'
    ? tasks.filter((task) => sameId(task.user_id, user?.id))
    : tasks.filter((task) =>
        sameId(task.specialist_id, user?.id) ||
        bids.some((bid) => sameId(bid.task_id, task.id) && sameId(bid.specialist_id, user?.id))
      );

  const activeTasks = myTasks.filter((task) => !['archived', 'expired'].includes(task.status));
  const openTasks = activeTasks.filter((task) => task.status === 'open');
  const acceptedTasks = activeTasks.filter((task) => ['active', 'delivered', 'completed', 'disputed'].includes(task.status));
  const deliveredTasks = activeTasks.filter((task) => task.work_delivered_at || task.status === 'delivered' || task.status === 'completed');
  const pendingReviews = activeTasks.filter((task) =>
    (task.confirmed_by_client_at || task.status === 'completed') && !task.review_id
  );
  const unreadAlerts = notifications.filter((notification) => notification.is_read === false || (!notification.is_read && !notification.read_at));
  const taskIds = new Set(myTasks.map((task) => String(task.id)));
  const proposalCount = role === 'client'
    ? bids.filter((bid) => bid.status === 'pending' && taskIds.has(String(bid.task_id))).length
    : bids.filter((bid) => sameId(bid.specialist_id, user?.id) && bid.status === 'pending').length;

  return [
    {
      key: 'discover',
      titleKey: role === 'client' ? 'findTrustedHelp' : 'findLocalWork',
      title: role === 'client' ? 'Find trusted help' : 'Find local work',
      copyKey: role === 'client' ? 'findTrustedHelpCopy' : 'findLocalWorkCopy',
      copy: role === 'client'
        ? 'Compare verified specialists, price guidance, service areas, and response quality.'
        : 'Scan nearby jobs with budget, district, urgency, and client reputation.',
      metric: role === 'client' ? `${openTasks.length} open requests` : `${proposalCount} proposals active`,
      metricKey: role === 'client' ? 'openRequests' : 'proposalsActive',
      metricValue: role === 'client' ? openTasks.length : proposalCount,
      state: openTasks.length > 0 || proposalCount > 0 ? 'active' : 'ready',
      action: 'Browse',
      actionKey: 'browse',
      targetTab: 'marketplace',
    },
    {
      key: 'request',
      titleKey: role === 'client' ? 'requestQuotes' : 'sendQuote',
      title: role === 'client' ? 'Request quotes' : 'Send quote',
      copyKey: role === 'client' ? 'requestQuotesCopy' : 'sendQuoteCopy',
      copy: role === 'client'
        ? 'Review specialist proposals while their 24-hour response windows are active.'
        : 'Share price, availability, scope, and proof of fit. Each proposal gives the client 24 hours to accept.',
      metric: `${proposalCount} pending`,
      metricKey: 'pending',
      metricValue: proposalCount,
      state: proposalCount > 0 ? 'active' : 'ready',
      action: role === 'client' ? 'Review proposals' : 'Send proposal',
      actionKey: role === 'client' ? 'reviewProposals' : 'sendProposal',
      targetTab: 'marketplace',
    },
    {
      key: 'match',
      titleKey: 'acceptMatch',
      title: 'Accept match',
      copyKey: 'acceptMatchCopy',
      copy: 'Accepted proposals open a private workspace tied to this job, client, and specialist.',
      metric: `${acceptedTasks.length} deal rooms`,
      metricKey: 'dealRooms',
      metricValue: acceptedTasks.length,
      state: acceptedTasks.length > 0 ? 'active' : 'pending',
      action: 'Workspace',
      actionKey: 'workspace',
      targetTab: 'messages',
    },
    {
      key: 'schedule',
      titleKey: 'planVisit',
      title: 'Plan the visit',
      copyKey: 'planVisitCopy',
      copy: 'Schedule, protected contact reveal, and next actions stay inside the workspace.',
      metric: unreadAlerts.length > 0 ? `${unreadAlerts.length} alerts` : 'No alerts',
      metricKey: unreadAlerts.length > 0 ? 'alerts' : 'noAlerts',
      metricValue: unreadAlerts.length,
      state: acceptedTasks.length > 0 ? 'active' : 'pending',
      action: 'Open schedule',
      actionKey: 'openSchedule',
      targetTab: 'messages',
    },
    {
      key: 'delivery',
      titleKey: 'confirmDelivery',
      title: 'Confirm delivery',
      copyKey: role === 'client' ? 'confirmDeliveryClientCopy' : 'confirmDeliverySpecialistCopy',
      copy: role === 'client'
        ? 'The specialist marks delivery, then you confirm the work from the control center.'
        : 'Mark delivery from the workspace so completion and reputation stay connected.',
      metric: `${deliveredTasks.length} delivered`,
      metricKey: 'delivered',
      metricValue: deliveredTasks.length,
      state: deliveredTasks.length > 0 ? 'active' : acceptedTasks.length > 0 ? 'ready' : 'pending',
      action: 'Check work',
      actionKey: 'checkWork',
      targetTab: 'messages',
    },
    {
      key: 'closeout',
      titleKey: 'reviewComplete',
      title: 'Review & complete',
      copyKey: 'reviewCompleteCopy',
      copy: 'Review the experience, seal reputation, and keep the receipt attached to the deal.',
      metric: pendingReviews.length > 0 ? `${pendingReviews.length} review due` : 'Reputation clean',
      metricKey: pendingReviews.length > 0 ? 'reviewDue' : 'reputationClean',
      metricValue: pendingReviews.length,
      state: pendingReviews.length > 0 ? 'urgent' : deliveredTasks.length > 0 ? 'ready' : 'pending',
      action: pendingReviews.length > 0 ? 'Leave review' : 'View receipt',
      actionKey: pendingReviews.length > 0 ? 'leaveReview' : 'viewReceipt',
      targetTab: 'messages',
    },
  ];
}

export default function MarketplaceWorkflowPanel({ user, role, tasks, bids, notifications, setActiveTab }) {
  const { t } = useLanguage();
  const stages = buildMarketplaceWorkflow({ user, role, tasks, bids, notifications });
  const metricLabel = (stage) => {
    if (stage.metricKey === 'noAlerts' || stage.metricKey === 'reputationClean') return t(stage.metricKey, stage.metric);
    return `${stage.metricValue} ${t(stage.metricKey, stage.metric.replace(String(stage.metricValue), '').trim())}`;
  };

  return (
    <section className="workflow-panel" aria-label="CatchUp service journey">
      <div className="workflow-panel-head">
        <div>
          <span className="dashboard-kicker">{t('catchupServiceJourney', 'CatchUp service journey')}</span>
          <h3>{t('requestToCloseout', 'From request to trusted closeout')}</h3>
          <p>
            {t('journeyIntro', 'Every job moves through quotes, a private workspace, delivery confirmation, review, and receipt.')}
          </p>
        </div>
        <div className="workflow-panel-controls" aria-label="Primary workflow actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('marketplace')}>
            {t('browse', 'Browse')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveTab('messages')}>
            {t('workspace', 'Workspace')}
          </button>
        </div>
      </div>

      <div className="workflow-stage-grid">
        {stages.map((stage, index) => (
          <article key={stage.key} className={`workflow-stage workflow-stage-${stage.state}`}>
            {index < stages.length - 1 && <span className="workflow-stage-link" aria-hidden="true" />}
            <div className="workflow-stage-top">
              <span className="workflow-stage-number">{index + 1}</span>
              <span className="workflow-stage-state">{stage.state}</span>
            </div>
            <strong>{t(stage.titleKey, stage.title)}</strong>
            <p>{t(stage.copyKey, stage.copy)}</p>
            <div className="workflow-stage-foot">
              <span>{metricLabel(stage)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveTab(stage.targetTab)}>
                {t(stage.actionKey, stage.action)}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
