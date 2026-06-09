import React, { useMemo } from 'react';
import FeedEmptyState from './FeedEmptyState';
import JobJourneyStepper, { getJourneyState } from './JobJourneyStepper';
import MarketplaceWorkflowPanel from './MarketplaceWorkflowPanel';
import { formatCurrency, normalizeEgyptMarket } from '../utils/statusHelpers';
import { useLanguage } from '../i18n/LanguageContext';
import SpecialistAvatar from './SpecialistAvatar';

const sameId = (left, right) => left != null && right != null && String(left) === String(right);

function StatCard({ label, value, sub }) {
  return (
    <div className="dashboard-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <em>{sub}</em>}
    </div>
  );
}

function DealRow({ task, bids, role, onOpenBrowse, onOpenWorkspace }) {
  const taskBids = bids.filter((bid) => sameId(bid.task_id, task.id));
  const journey = getJourneyState({ task, bids: taskBids });
  const clientProfile = task.client || null;
  const clientName = clientProfile?.full_name || task.client_name || 'Verified client';
  const nextAction =
    role === 'client'
      ? task.status === 'open' && taskBids.length > 0
        ? 'Review proposals'
        : task.status === 'open'
        ? 'Wait for proposals'
        : 'Open workspace'
      : task.status === 'open'
      ? taskBids.some((bid) => bid.status === 'pending')
        ? 'Proposal sent'
        : 'Send proposal'
      : 'Open workspace';

  return (
    <article className="dashboard-deal-row">
      <div className="dashboard-deal-main">
        <span className="dashboard-kicker">{task.category || 'General'} · {normalizeEgyptMarket(task.district_tag)}</span>
        <strong>{task.title || 'Marketplace job'}</strong>
        <div className="dashboard-deal-client">
          <SpecialistAvatar name={clientName} avatarUrl={clientProfile?.avatar_url} size={30} />
          <span>{clientName}</span>
        </div>
        <JobJourneyStepper compact task={task} bids={taskBids} />
      </div>
      <div className="dashboard-deal-side">
        <span>{task.budget ? formatCurrency(task.budget) : 'Open budget'}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={journey.complete.accepted ? onOpenWorkspace : onOpenBrowse}
        >
          {nextAction}
        </button>
      </div>
    </article>
  );
}

export default function DashboardHome({
  user,
  role,
  tasks = [],
  bids = [],
  specialists = [],
  notifications = [],
  unreadCount = 0,
  setActiveTab,
}) {
  const { t } = useLanguage();
  const dashboard = useMemo(() => {
    const myTasks = role === 'client'
      ? tasks.filter((task) => sameId(task.user_id, user?.id))
      : tasks.filter((task) =>
          bids.some((bid) => sameId(bid.task_id, task.id) && sameId(bid.specialist_id, user?.id)) ||
          sameId(task.specialist_id, user?.id)
        );
    const activeDeals = myTasks.filter((task) => !['completed', 'archived', 'expired'].includes(task.status));
    const myTaskIds = new Set(myTasks.map((task) => String(task.id)));
    const pendingProposals = role === 'client'
      ? bids.filter((bid) => bid.status === 'pending' && myTaskIds.has(String(bid.task_id))).length
      : bids.filter((bid) => sameId(bid.specialist_id, user?.id) && bid.status === 'pending').length;
    const verifiedSpecialists = specialists.filter((specialist) => specialist.is_verified).length;
    const alerts = notifications
      .filter((notification) => notification.is_read === false || (!notification.is_read && !notification.read_at))
      .slice(0, 4);

    return {
      myTasks,
      activeDeals,
      pendingProposals,
      verifiedSpecialists,
      alerts,
    };
  }, [bids, notifications, role, specialists, tasks, user?.id]);

  const headline = role === 'client'
    ? t('yourHiringDesk', 'Your hiring desk')
    : t('yourSpecialistDesk', 'Your specialist desk');

  return (
    <div className="dashboard-home">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">{t('operationalDashboard', 'Operational dashboard')}</span>
          <h2>{headline}</h2>
          <p>
            {t('dashboardIntro', 'Track active deals, proposals, messages, and trust signals from one place.')}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('messages')}>
            {t('openWorkspace', 'Open workspace')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveTab('marketplace')}>
            {t('browseMarketplace', 'Browse marketplace')}
          </button>
        </div>
      </header>

      <section className="dashboard-stats-grid">
        <StatCard label={t('activeDeals', 'Active deals')} value={dashboard.activeDeals.length} sub={t('activeDealsSub', 'Open or in progress')} />
        <StatCard label={t('nextProposals', 'Next proposals')} value={dashboard.pendingProposals} sub={role === 'client' ? t('needReview', 'Need review') : t('awaitingClients', 'Awaiting clients')} />
        <StatCard label={t('unreadMessages', 'Unread messages')} value={unreadCount} sub={t('workspaceAlerts', 'Workspace alerts')} />
        <StatCard label={t('verifiedSupply', 'Verified supply')} value={dashboard.verifiedSpecialists} sub={t('trustedSpecialists', 'Trusted specialists')} />
      </section>

      <MarketplaceWorkflowPanel
        user={user}
        role={role}
        tasks={tasks}
        bids={bids}
        notifications={notifications}
        setActiveTab={setActiveTab}
      />

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-head">
            <span className="dashboard-kicker">{t('nextActions', 'Next actions')}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveTab('marketplace')}>
              {t('viewAll', 'View all')}
            </button>
          </div>
          {dashboard.activeDeals.length === 0 ? (
            <FeedEmptyState
              variant="tasks"
              icon="✓"
              title="No active deals yet"
              description={role === 'client' ? 'Post a job or browse specialists to start a workspace.' : 'Browse open jobs and send a proposal to start a workspace.'}
              showReset={false}
            />
          ) : (
            <div className="dashboard-deal-list">
              {dashboard.activeDeals.slice(0, 5).map((task) => (
                <DealRow
                  key={task.id}
                  task={task}
                  bids={bids}
                  role={role}
                  onOpenBrowse={() => setActiveTab('marketplace')}
                  onOpenWorkspace={() => setActiveTab('messages')}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="dashboard-panel dashboard-alert-panel">
          <div className="dashboard-panel-head">
            <span className="dashboard-kicker">{t('alerts', 'Alerts')}</span>
            <span className="dashboard-alert-count">{dashboard.alerts.length}</span>
          </div>
          {dashboard.alerts.length === 0 ? (
            <p className="dashboard-muted">{t('noPendingAlerts', 'No pending alerts. Your workspace queue is clean.')}</p>
          ) : (
            dashboard.alerts.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="dashboard-alert"
                onClick={() => setActiveTab('messages')}
              >
                <strong>{notification.title || notification.type || 'Workspace update'}</strong>
                <span>{notification.message || notification.body || 'Open the workspace for details.'}</span>
              </button>
            ))
          )}
        </aside>
      </section>
    </div>
  );
}
