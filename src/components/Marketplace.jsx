import React, { useState, useMemo, useEffect, useOptimistic, useCallback } from 'react';
import { useToast } from './Toast';
import {
  createTask,
  submitBid,
  acceptBid,
  fetchPlatformSettings,
  fetchAgreement,
  fetchWorkspaceRoom,
  rateClient,
  fetchSpecialistRatings,
  cancelTask,
} from '../services/supabaseService';
import FeedEmptyState from './FeedEmptyState';
import ClientReputationBadge from './ClientReputationBadge';
import { useClientReputation } from '../hooks/useClientReputation';
import {
  CATEGORIES,
  DISTRICTS,
  formatCurrency,
  isProposalExpired,
  matchesEgyptMarket,
  normalizeEgyptMarket,
  proposalWindowLabel,
} from '../utils/statusHelpers';
import SpecialistAvatar from './SpecialistAvatar';
import SpecialistReputationCard from './SpecialistReputationCard';
import { useSpecialistReputations } from '../hooks/useSpecialistReputation';
import AgreementSnapshot from './AgreementSnapshot';
import LocalPriceInsight from './LocalPriceInsight';
import { getLocalPriceInsight } from '../utils/lifecycleInsights';
import JobJourneyStepper from './JobJourneyStepper';
import CatchUpServiceFlow from './CatchUpServiceFlow';
import { useLanguage } from '../i18n/LanguageContext';
import PaymentBetaNotice from './PaymentBetaNotice';

function Badge({ text, type = 'muted' }) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

const sameId = (left, right) => {
  if (left == null || right == null) return false;
  return String(left) === String(right);
};

const formatRating = (value) => {
  const rating = Number(value || 0);
  return rating > 0 ? rating.toFixed(1) : 'New';
};

const numericRate = (value) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const responseSpeedLabel = (profile, reputation) => {
  const hours = Number(reputation?.avg_response_hours ?? profile?.avg_response_hours);
  if (Number.isFinite(hours) && hours > 0) return hours <= 1 ? '< 1h' : `${Math.round(hours)}h`;
  return reputation?.response_quality || profile?.response_quality || 'Fast replies';
};

const taskClientProfile = (task) => task?.client || task?.profiles || null;

const taskClientName = (task) =>
  taskClientProfile(task)?.full_name ||
  task?.client_name ||
  'Verified client';

export default function Marketplace({
  user,
  profile,
  role,
  tasks = [],
  bids = [],
  specialists = [],
  loading = false,
  error = null,
  districtFilter,
  setDistrictFilter,
  syncPlatformEngineData,
  setActiveTab,
  setActiveRoom,
}) {
  const toast = useToast();
  const { t } = useLanguage();
  const [subView, setSubView] = useState('jobs');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [cancelingTaskId, setCancelingTaskId] = useState(null);

  // Agreement snapshot state
  const [showAgreementSnapshot, setShowAgreementSnapshot] = useState(false);
  const [agreementSnapshot, setAgreementSnapshot] = useState(null);
  const [agreementLoading, setAgreementLoading] = useState(false);

  // Bid submission state (by task ID)
  const [bidAmounts, setBidAmounts] = useState({});
  const [bidNotes, setBidNotes] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [bidErrors, setBidErrors] = useState({});

  // Optimistic state for bid submission: shows form as cleared immediately
  const [optimisticBidState, updateOptimisticBidState] = useOptimistic(
    { amounts: bidAmounts, notes: bidNotes },
    (state, action) => {
      if (action.type === 'SUBMIT') {
        return {
          amounts: { ...state.amounts, [action.taskId]: '' },
          notes: { ...state.notes, [action.taskId]: '' },
        };
      }
      if (action.type === 'ROLLBACK') {
        return { amounts: bidAmounts, notes: bidNotes };
      }
      return state;
    }
  );

  // Task creation state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newDistrict, setNewDistrict] = useState('Cairo');
  const [newBudget, setNewBudget] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [posting, setPosting] = useState(false);
  // Client rating modal state
  const [rateModalTask, setRateModalTask] = useState(null);
  const [rateValue, setRateValue] = useState(5);
  const [rateCommentText, setRateCommentText] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratedTaskIds, setRatedTaskIds] = useState(new Set());

  // Filter tasks based on status and search
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status !== 'open') return false;
      const districtMatch = matchesEgyptMarket(t.district_tag, districtFilter);
      const searchLower = search.toLowerCase();
      const searchMatch =
        !search ||
        t.title?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.category?.toLowerCase().includes(searchLower) ||
        t.district_tag?.toLowerCase().includes(searchLower);
      return districtMatch && searchMatch;
    });
  }, [tasks, districtFilter, search]);

  // Prepare specialist reputation fetch for visible specialists and bidders
  const visibleSpecialistIds = useMemo(() => {
    const ids = new Set();
    specialists.forEach(s => s.id && ids.add(s.id));
    bids.forEach(b => b.specialist_id && ids.add(b.specialist_id));
    return Array.from(ids);
  }, [specialists, bids]);

  const { reputations = {} } = useSpecialistReputations(visibleSpecialistIds);

  const filteredSpecialists = useMemo(() => {
    const filtered = specialists.filter(sp => {
      const isVerifiedForBeta = sp.is_verified || sp.verification_status === 'verified';
      if (!isVerifiedForBeta && !sameId(sp.id, user?.id)) return false;
      const districtMatch = matchesEgyptMarket(sp.district_tag, districtFilter);
      const searchLower = search.toLowerCase();
      const searchMatch =
        !search ||
        sp.full_name?.toLowerCase().includes(searchLower) ||
        sp.category?.toLowerCase().includes(searchLower) ||
        sp.district_tag?.toLowerCase().includes(searchLower) ||
        sp.bio?.toLowerCase().includes(searchLower);
      return districtMatch && searchMatch;
    });

    return filtered.sort((a, b) => {
      const aRep = reputations[a.id] || {};
      const bRep = reputations[b.id] || {};
      const aVerified = aRep.is_verified || a.is_verified ? 1 : 0;
      const bVerified = bRep.is_verified || b.is_verified ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;

      const aRating = Number(aRep.average_rating || 0);
      const bRating = Number(bRep.average_rating || 0);
      if (bRating !== aRating) return bRating - aRating;

      const aJobs = Number(aRep.total_completed_jobs || 0);
      const bJobs = Number(bRep.total_completed_jobs || 0);
      if (bJobs !== aJobs) return bJobs - aJobs;

      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [specialists, districtFilter, search, reputations, user?.id]);

  const hasFilters = search.trim() !== '' || districtFilter !== 'all';
  const openJobsCount = filteredTasks.filter(t => t.status === 'open').length;
  const visibleTaskIds = useMemo(
    () => new Set(filteredTasks.map((task) => String(task.id))),
    [filteredTasks]
  );
  const pendingProposalCount = bids.filter((bid) => {
    if (bid.status !== 'pending') return false;
    if (role === 'specialist') return sameId(bid.specialist_id, user?.id);
    return visibleTaskIds.has(String(bid.task_id));
  }).length;
  const verifiedSpecialistsCount = filteredSpecialists.filter((specialist) => {
    const reputation = reputations[specialist.id] || {};
    return reputation.is_verified || specialist.is_verified;
  }).length;
  const activeDistrictCount = new Set(
    filteredTasks
      .map((task) => normalizeEgyptMarket(task.district_tag, ''))
      .filter(Boolean)
  ).size;
  const averageVisibleRating = (() => {
    const ratings = filteredSpecialists
      .map((specialist) => Number(reputations[specialist.id]?.average_rating || reputations[specialist.id]?.rating_average || 0))
      .filter((rating) => rating > 0);
    if (!ratings.length) return 'New';
    return (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1);
  })();
  const marketplacePulse = [
    {
      value: `${verifiedSpecialistsCount}/${filteredSpecialists.length || 0}`,
      label: t('verifiedSupplyShort', 'verified specialists'),
      help: t('verifiedSupplyHelp', 'Verified specialists among the providers currently visible in this marketplace view.'),
    },
    {
      value: activeDistrictCount || DISTRICTS.length,
      label: t('districtsCovered', 'governorates covered'),
    },
    {
      value: averageVisibleRating,
      label: t('averageRatingShort', 'avg. rating'),
    },
  ];
  const createPriceInsight = useMemo(
    () => getLocalPriceInsight({
      tasks,
      bids,
      category: newCategory,
      district: newDistrict,
      amount: newBudget,
    }),
    [tasks, bids, newCategory, newDistrict, newBudget]
  );

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBudget || !newDesc.trim()) {
      toast('Please fill in all fields.', 'error');
      return;
    }

    setPosting(true);
    try {
      await createTask({
        user_id: user.id,
        client_name: profile?.full_name || user.user_metadata?.full_name || 'Verified client',
        title: newTitle,
        category: newCategory,
        district_tag: newDistrict,
        budget: parseFloat(newBudget),
        description: newDesc,
        status: 'open',
      });

      setNewTitle('');
      setNewBudget('');
      setNewDesc('');
      setShowCreate(false);
      toast('Task posted successfully!', 'success');
      await syncPlatformEngineData();
    } catch (err) {
      toast('Failed to post task: ' + err.message, 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleSubmitBid = useCallback(
    async (taskId) => {
      const specialistVerified = profile?.is_verified || profile?.verification_status === 'verified';
      if (role === 'specialist' && !specialistVerified) {
        toast('Specialist accounts must be manually verified before sending beta proposals.', 'error');
        return;
      }

      const settings = await fetchPlatformSettings();
      if (settings?.onboarding?.paused) {
        toast(settings.onboarding.reason || 'Beta onboarding is paused right now.', 'error');
        return;
      }

      const bidAmount = bidAmounts[taskId];
      const proposalText = bidNotes[taskId];

      if (!bidAmount || !proposalText) {
        toast('Please enter a price and a proposal pitch.', 'error');
        return;
      }

      // 1. Optimistic UI: immediately show form as cleared
      updateOptimisticBidState({ type: 'SUBMIT', taskId });
      setSubmitting(p => ({ ...p, [taskId]: true }));

      try {
        // 2. Mutation in background
        await submitBid({
          task_id: taskId,
          specialist_id: user.id,
          amount: parseFloat(bidAmount),
          note: proposalText,
          status: 'pending',
        });

        // 3. Clear actual state after success
        setBidAmounts(p => ({ ...p, [taskId]: '' }));
        setBidNotes(p => ({ ...p, [taskId]: '' }));
        setBidErrors(prev => {
          const c = { ...prev };
          delete c[taskId];
          return c;
        });

        toast('Proposal sent. The client has 24 hours to accept this proposal before it expires.', 'success');
        await syncPlatformEngineData();
      } catch (err) {
        // On error, rollback optimistic state
        updateOptimisticBidState({ type: 'ROLLBACK' });
        setBidErrors(prev => ({
          ...prev,
          [taskId]: err?.message || 'Failed to submit bid',
        }));
        console.error('Bid error:', err);
        toast('Failed to submit proposal', 'error');
      } finally {
        setSubmitting(p => ({ ...p, [taskId]: false }));
      }
    },
    [bidAmounts, bidNotes, profile?.is_verified, profile?.verification_status, role, updateOptimisticBidState, user.id, toast, syncPlatformEngineData]
  );

  const handleCancelTask = async (taskId) => {
    setCancelingTaskId(taskId);
    try {
      await cancelTask(taskId, user.id);
      toast('Task cancelled successfully.', 'success');
      await syncPlatformEngineData();
    } catch (err) {
      toast('Unable to cancel task: ' + (err?.message || err), 'error');
    } finally {
      setCancelingTaskId(null);
    }
  };

  const handleAcceptBid = useCallback(
    async (task, bid) => {
      if (isProposalExpired(bid)) {
        toast('This proposal window has expired. Ask the specialist to send a new proposal.', 'error');
        await syncPlatformEngineData();
        return;
      }

      // 1. Optimistic UI: show agreement snapshot immediately (with loading state)
      setShowAgreementSnapshot(true);
      setAgreementLoading(true);
      setAgreementSnapshot({ 
        loading: true, 
        task_id: task.id, 
        specialist_id: bid.specialist_id,
        agreed_amount: bid.amount 
      });

      try {
        // 2. Mutation in background
        const result = await acceptBid(
          task.id,
          bid.id,
          bid.specialist_id,
          bid.amount
        );

        const { gross, fee, net, agreementId, roomId } = result;
        if (roomId && setActiveRoom) {
          try {
            const workspaceRoom = await fetchWorkspaceRoom(roomId);
            setActiveRoom(workspaceRoom);
          } catch (roomErr) {
            console.warn('Could not fetch workspace room after bid acceptance:', roomErr);
          }
        }

        // 3. Fetch the full agreement to display in snapshot
        if (agreementId) {
          const agreement = await fetchAgreement(agreementId);
          setAgreementSnapshot(agreement);
        } else {
          setAgreementSnapshot({
            task_id: task.id,
            specialist_id: bid.specialist_id,
            agreed_amount: bid.amount,
          });
        }
        setShowAgreementSnapshot(true);
        setAgreementLoading(false);

        toast(
          `✅ Bid accepted!\n\nTotal: ${formatCurrency(gross)}\nPlatform fee (10%): ${formatCurrency(fee)}\nSpecialist receives: ${formatCurrency(net)}`,
          'success'
        );

        if (setActiveTab) setActiveTab('messages');
        await syncPlatformEngineData();
      } catch (err) {
        // On error, close snapshot and show error
        setShowAgreementSnapshot(false);
        setAgreementSnapshot(null);
        setAgreementLoading(false);
        toast('❌ Error accepting bid: ' + err.message, 'error');
      }
    },
    [setActiveRoom, setActiveTab, toast, syncPlatformEngineData]
  );

  const handleAgreementSnapshotClose = () => {
    setShowAgreementSnapshot(false);
    setAgreementSnapshot(null);
  };

  const handleAgreementSnapshotAccept = async () => {
    handleAgreementSnapshotClose();
    if (setActiveTab) setActiveTab('messages');
  };

  function ClientReputationInline({ clientId, compact = true }) {
    const { reputation } = useClientReputation(clientId);
    if (!reputation) return null;
    return <ClientReputationBadge reputation={reputation} compact={compact} />;
  }

  const openRateModal = (task) => {
    setRateModalTask(task);
    setRateValue(5);
    setRateCommentText('');
  };

  const closeRateModal = () => {
    setRateModalTask(null);
    setRateValue(5);
    setRateCommentText('');
    setRatingSubmitting(false);
  };

  const submitClientRating = async () => {
    if (!rateModalTask) return;
    setRatingSubmitting(true);
    try {
      await rateClient(user.id, rateModalTask.user_id, rateModalTask.id, Number(rateValue), rateCommentText);
      toast('Client rated — thank you!', 'success');
      await syncPlatformEngineData();
      // Mark locally to update UI immediately
      setRatedTaskIds(prev => new Set(Array.from(prev).concat([rateModalTask.id])));
      closeRateModal();
    } catch (err) {
      toast('Failed to submit rating: ' + (err?.message || err), 'error');
      setRatingSubmitting(false);
    }
  };

  // Fetch existing ratings by this specialist for visible tasks so we can hide the rate button
  useEffect(() => {
    if (role !== 'specialist' || !user?.id || filteredTasks.length === 0) return;
    const taskIds = filteredTasks.map(t => t.id).filter(Boolean);
    let mounted = true;
    (async () => {
      try {
        const rows = await fetchSpecialistRatings(user.id, taskIds);
        if (!mounted) return;
        const ids = new Set((rows || []).map(r => String(r.task_id)));
        setRatedTaskIds(ids);
      } catch (err) {
        console.warn('Could not fetch specialist ratings:', err);
      }
    })();
    return () => { mounted = false; };
  }, [role, user?.id, filteredTasks]);

  const catBadge = {
    Cleaning: 'green',
    Tutoring: 'blue',
    Beauty: 'gold',
    'Moving help': 'muted',
    'Simple repairs': 'muted',
  };

  return (
    <div className="marketplace-container">
      {/* ── Header ── */}
      <div className="marketplace-header marketplace-hero-panel">
        <div className="marketplace-hero-top">
          <div className="marketplace-hero-copy">
            <h2 style={{ marginBottom: 4 }}>
              {t('marketplaceTitle', 'Find the right specialist in Cairo/Alexandria')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
              {role === 'client'
                ? t('marketplaceClientIntro', 'Post requests, compare manually reviewed specialists in Cairo/Alexandria, and move accepted work into a protected workspace.')
                : t('marketplaceSpecialistIntro', 'Verified specialists can browse Cairo/Alexandria beta jobs, send strong quotes, and build reputation through completed work.')}
            </p>
            <div className="marketplace-community-row" aria-label="Marketplace trust signals">
              {marketplacePulse.map((item) => (
                <div key={item.label} className="marketplace-community-stat" title={item.help || item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="marketplace-live-panel" aria-label="Marketplace activity">
            <div className="marketplace-live-head">
              <span>{t('communityMarket', 'Egypt market')}</span>
              <strong>{t('liveNow', 'Live now')}</strong>
            </div>
            <div className="marketplace-live-map">
              <span>Cairo</span>
              <span>Alexandria</span>
              <span>Beta only</span>
              <span>Manual review</span>
            </div>
            <div className="marketplace-live-avatars" aria-hidden="true">
              {filteredSpecialists.slice(0, 4).map((specialist) => (
                <SpecialistAvatar
                  key={specialist.id}
                  name={specialist.full_name}
                  avatarUrl={specialist.avatar_url}
                  size={34}
                />
              ))}
              {filteredSpecialists.length === 0 && (
                <>
                  <SpecialistAvatar name="CatchUp Specialist" size={34} />
                  <SpecialistAvatar name="Egypt Provider" size={34} />
                  <SpecialistAvatar name="Verified Pro" size={34} />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="marketplace-command-bar">
          <div className="marketplace-search-cluster">
            <div className="search-bar">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-3)"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                placeholder={t('searchMarketplace', 'Search jobs, specialists, governorates...')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="marketplace-clear-search"
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label={t('clearSearch', 'Clear search')}
                >
                  ×
                </button>
              )}
            </div>
            <select
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
              className="marketplace-district-select"
            >
              <option value="all">{t('allDistricts', 'Cairo/Alexandria beta')}</option>
              {DISTRICTS.map(d => (
                <option key={d} value={d.toLowerCase()}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="marketplace-hero-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={syncPlatformEngineData}
              disabled={loading}
            >
              {loading ? t('refreshing', 'Refreshing...') : t('refresh', 'Refresh')}
            </button>
            {role === 'client' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreate(true)}
              >
                {t('postJob', 'Post a job')}
              </button>
            )}
          </div>
        </div>

        <div className="marketplace-summary-strip" aria-live="polite">
          <button
            type="button"
            className={`marketplace-summary-item ${subView === 'jobs' ? 'active' : ''}`}
            onClick={() => setSubView('jobs')}
          >
            <span className="marketplace-summary-value">{openJobsCount}</span>
            <span className="marketplace-summary-label">{t('openJobs', 'Open jobs')}</span>
          </button>
          <button
            type="button"
            className={`marketplace-summary-item ${subView === 'specialists' ? 'active' : ''}`}
            onClick={() => setSubView('specialists')}
          >
            <span className="marketplace-summary-value">{filteredSpecialists.length}</span>
            <span className="marketplace-summary-label">{t('specialistsLabel', 'Specialists')}</span>
          </button>
          <div className="marketplace-summary-item">
            <span className="marketplace-summary-value">{pendingProposalCount}</span>
            <span className="marketplace-summary-label">
              {role === 'client' ? t('yourProposals', 'Your proposals') : t('sentProposals', 'Sent proposals')}
            </span>
          </div>
        </div>

        {error && (
          <div className="marketplace-sync-alert" role="alert">
            {t('marketplaceDataError', 'Marketplace data could not load:')} {error}
          </div>
        )}

        {/* View toggle */}
        <div className="marketplace-flow-dock">
          <CatchUpServiceFlow role={role} context="marketplace" activeIndex={subView === 'specialists' ? 0 : 1} />
          <div className="view-toggle">
            <button
              className={subView === 'jobs' ? 'active' : ''}
              onClick={() => setSubView('jobs')}
            >
              {t('jobsBoard', 'Jobs board')}
            </button>
            <button
              className={subView === 'specialists' ? 'active' : ''}
              onClick={() => setSubView('specialists')}
            >
              {t('specialistsLabel', 'Specialists')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Jobs view ── */}
      <PaymentBetaNotice compact />
      {subView === 'jobs' && (
        <div className="marketplace-feed-column">
          {loading && filteredTasks.length === 0 ? (
            <FeedEmptyState
              variant="tasks"
              icon="↻"
              title="Loading marketplace jobs"
              description="Fetching the latest open tasks from Supabase."
              showReset={false}
            />
          ) : filteredTasks.length === 0 ? (
            <FeedEmptyState
              variant="tasks"
              icon="📋"
              title={hasFilters ? 'No matching jobs' : 'No open jobs found'}
              description={
                hasFilters
                  ? 'Try broadening your search or clearing the filters.'
                  : role === 'client'
                  ? 'Post a job or open the specialists tab to find available providers.'
                  : 'No open jobs right now. Check back soon.'
              }
              resetLabel="Clear filters"
              onReset={() => {
                setSearch('');
                setDistrictFilter('all');
              }}
              showReset={hasFilters}
            />
          ) : (
            filteredTasks.map(task => {
              const taskBids = bids.filter(b => sameId(b.task_id, task.id));
              const actionableBids = taskBids.filter(b => b.status === 'pending' && !isProposalExpired(b));
              const expiredBids = taskBids.filter(b => isProposalExpired(b));
              const myBid = taskBids.find(b => sameId(b.specialist_id, user?.id));
              const taskPriceInsight = getLocalPriceInsight({
                tasks,
                bids,
                category: task.category,
                district: task.district_tag,
                amount: bidAmounts[task.id],
              });

              return (
                <div key={task.id} className="task-card">
                  <div className="task-card-shell">
                    <div className="task-card-main">
                      <div className="task-card-kicker-row">
                        <div className="task-card-badges">
                          <Badge text={task.category || 'General'} type={catBadge[task.category] || 'muted'} />
                          <Badge
                            text={task.status === 'open' ? 'Open' : task.status === 'active' ? 'In progress' : task.status}
                            type={task.status === 'open' ? 'green' : task.status === 'active' ? 'blue' : 'muted'}
                          />
                        </div>
                        <span className="task-card-distance">{normalizeEgyptMarket(task.district_tag)}</span>
                      </div>

                      <div className="task-title">{task.title}</div>

                      <div className="task-client-strip">
                        <SpecialistAvatar
                          name={taskClientName(task)}
                          avatarUrl={taskClientProfile(task)?.avatar_url}
                          size={42}
                        />
                        <div>
                          <span>Posted by</span>
                          <strong>{taskClientName(task)}</strong>
                        </div>
                        {taskClientProfile(task)?.is_verified && <Badge text="Verified" type="green" />}
                      </div>

                      <p className="task-description">
                        {task.description}
                      </p>

                      <div className="task-trust-grid">
                        <div>
                          <span>Client</span>
                          <strong>{taskClientName(task)}</strong>
                        </div>
                        <div>
                          <span>Posted</span>
                          <strong>{task.created_at ? new Date(task.created_at).toLocaleDateString() : 'Recently'}</strong>
                        </div>
                        <div>
                          <span>Proposals</span>
                          <strong>{actionableBids.length}</strong>
                        </div>
                        <div>
                          <span>Next action</span>
                          <strong>
                            {role === 'client' && sameId(user?.id, task.user_id)
                              ? actionableBids.length > 0
                                ? 'Review bids'
                                : 'Awaiting bids'
                              : myBid
                              ? isProposalExpired(myBid)
                                ? 'Proposal expired'
                                : 'Bid sent'
                              : 'Quote ready'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <aside className="task-card-aside">
                      <span className="task-price-label">Budget</span>
                      <span className="task-budget">
                        {task.budget ? formatCurrency(task.budget) : 'Open budget'}
                      </span>
                      <span className="task-safety-note">Private workspace after acceptance</span>
                    </aside>
                  </div>

                  <div className="task-journey-wrap">
                    <JobJourneyStepper compact task={task} bids={taskBids} />
                  </div>

                  <div className="task-card-lower">
                    <div className="task-meta task-actions-row">
                      {role === 'client' && sameId(user?.id, task.user_id) && task.status === 'open' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={cancelingTaskId === task.id}
                          onClick={() => handleCancelTask(task.id)}
                        >
                          {cancelingTaskId === task.id ? 'Cancelling...' : 'Cancel task'}
                        </button>
                      )}
                      {role === 'specialist' && task.client_name && (
                        <ClientReputationInline clientId={task.user_id} compact={true} />
                      )}
                    </div>
                  </div>

                  {role === 'specialist' && sameId(user?.id, task.specialist_id) && task.status === 'completed' && (
                    <div style={{ marginBottom: 12 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openRateModal(task)}
                        disabled={ratingSubmitting || ratedTaskIds.has(String(task.id))}
                      >
                        {ratedTaskIds.has(String(task.id)) ? 'Client rated' : 'Rate client'}
                      </button>
                    </div>
                  )}

                  {/* Specialist: bid form */}
                  {role === 'specialist' && task.status === 'open' && !sameId(user?.id, task.user_id) && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                      {myBid && !isProposalExpired(myBid) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <Badge
                            text={isProposalExpired(myBid) ? 'Proposal expired' : 'Proposal submitted'}
                            type={isProposalExpired(myBid) ? 'muted' : 'green'}
                          />
                          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                            {isProposalExpired(myBid)
                              ? 'Send a fresh proposal if the client still needs help.'
                              : `Waiting for client response · ${proposalWindowLabel(myBid)}`}
                          </span>
                        </div>
                      ) : (
                        <>
                          {myBid && isProposalExpired(myBid) && (
                            <div className="fee-breakdown-card proposal-expired-renewal">
                              Your previous proposal expired. Send a fresh price and pitch to reopen a 24-hour client response window.
                            </div>
                          )}
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              color: 'var(--text-2)',
                              marginBottom: 12,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}
                          >
                            Submit a proposal
                          </div>
                          {bidErrors[task.id] && (
                            <div
                              className="fee-breakdown-card"
                              style={{
                                borderColor: 'rgba(239,68,68,0.12)',
                                background: 'rgba(239,68,68,0.04)',
                                color: 'var(--danger)',
                                marginBottom: 12,
                              }}
                            >
                              {bidErrors[task.id]}
                            </div>
                          )}
                          <LocalPriceInsight
                            insight={taskPriceInsight}
                            amount={bidAmounts[task.id]}
                          />
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '160px 1fr',
                              gap: 12,
                              marginBottom: 12,
                            }}
                          >
                            <input
                              type="number"
                              className="premium-input"
                              placeholder="Your price (EGP)"
                              value={optimisticBidState.amounts[task.id] || ''}
                              onChange={e =>
                                setBidAmounts(p => ({
                                  ...p,
                                  [task.id]: e.target.value,
                                }))
                              }
                              disabled={submitting[task.id]}
                              style={{ margin: 0 }}
                            />
                            <input
                              type="text"
                              className="premium-input"
                              placeholder="Brief pitch — why are you the right person for this job?"
                              value={optimisticBidState.notes[task.id] || ''}
                              onChange={e =>
                                setBidNotes(p => ({
                                  ...p,
                                  [task.id]: e.target.value,
                                }))
                              }
                              disabled={submitting[task.id]}
                              style={{ margin: 0 }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              className="btn btn-primary"
                              disabled={submitting[task.id]}
                              onClick={() => handleSubmitBid(task.id)}
                            >
                              {submitting[task.id] ? '⏳ Submitting…' : '✓ Send proposal'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {role === 'specialist' && task.status === 'open' && sameId(user?.id, task.user_id) && (
                    <div style={{ padding: '16px 0', color: 'var(--text-3)', fontSize: 13 }}>
                      You cannot submit a proposal on your own task.
                    </div>
                  )}

                  {/* Client: incoming bids */}
                  {role === 'client' && taskBids.length > 0 && sameId(user?.id, task.user_id) && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: 'var(--text-2)',
                          marginBottom: 12,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        Proposals ({actionableBids.length} active{expiredBids.length ? ` · ${expiredBids.length} expired` : ''})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {taskBids
                          .filter(b => b.status === 'pending' || b.status === 'expired')
                          .sort((left, right) => Number(isProposalExpired(left)) - Number(isProposalExpired(right)))
                          .map(bid => (
                            <div key={bid.id} className={`bid-card ${isProposalExpired(bid) ? 'bid-card-expired' : ''}`}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 12,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div className="bid-specialist-summary">
                                  <SpecialistAvatar
                                    name={bid.profiles?.full_name}
                                    avatarUrl={bid.profiles?.avatar_url}
                                    size={44}
                                  />
                                  <div>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: 14,
                                        color: 'var(--text)',
                                        marginBottom: 2,
                                      }}
                                    >
                                      {bid.profiles?.full_name || 'Specialist'}
                                    </div>
                                    <p
                                      style={{
                                        fontSize: 13,
                                        color: 'var(--text-2)',
                                        margin: '4px 0 0',
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      "{bid.note || bid.pitch || bid.proposal_text || 'No message provided.'}"
                                    </p>
                                    <div className="proposal-window-row">
                                      <Badge
                                        text={isProposalExpired(bid) ? 'Expired' : proposalWindowLabel(bid)}
                                        type={isProposalExpired(bid) ? 'muted' : 'green'}
                                      />
                                      <span>
                                        {isProposalExpired(bid)
                                          ? 'Ask for a fresh proposal before opening a workspace.'
                                          : 'Accept before the response window closes.'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div
                                    style={{
                                      fontFamily: 'var(--font-display)',
                                      fontSize: 20,
                                      fontWeight: 600,
                                      color: 'var(--green)',
                                      marginBottom: 8,
                                    }}
                                  >
                                    {formatCurrency(bid.amount ?? 0)}
                                  </div>
                                  {task.status === 'open' && (
                                    <button
                                      className="btn btn-success btn-sm"
                                      disabled={isProposalExpired(bid)}
                                      onClick={() => handleAcceptBid(task, bid)}
                                    >
                                      {isProposalExpired(bid) ? 'Expired' : 'Accept & open workspace'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Specialists view ── */}
      {subView === 'specialists' && (
        <div className="marketplace-feed-column">
          {loading && filteredSpecialists.length === 0 ? (
            <FeedEmptyState
              variant="specialists"
              icon="↻"
              title="Loading specialists"
              description="Fetching registered service providers from Supabase."
              showReset={false}
            />
          ) : filteredSpecialists.length === 0 ? (
            <FeedEmptyState
              variant="specialists"
              icon="🛠️"
              title={hasFilters ? 'No matching specialists' : 'No specialists yet'}
              description={hasFilters
                ? 'Try broadening your search or clearing the filters.'
                : 'More specialists will join soon.'}
              resetLabel="Clear filters"
              onReset={() => {
                setSearch('');
                setDistrictFilter('all');
              }}
              showReset={hasFilters}
            />
          ) : (
            filteredSpecialists.map(spec => {
              const reputation = reputations[spec.id] || {};
              const verified = reputation.is_verified || spec.is_verified;
              const completedJobs = Number(reputation.total_completed_jobs || 0);
              const rating = reputation.average_rating || reputation.rating_average;
              const skills = [spec.category, spec.professional_title || spec.job_title]
                .filter(Boolean)
                .slice(0, 3);

              return (
                <article key={spec.id} className="specialist-storefront-card">
                  <div className="specialist-storefront-shell">
                    <div className="specialist-storefront-main">
                      <SpecialistAvatar name={spec.full_name} avatarUrl={spec.avatar_url} size={64} />
                      <div>
                        <div className="specialist-storefront-title">
                          <strong>{spec.full_name || 'Specialist'}</strong>
                          {verified && <Badge text="Verified" type="green" />}
                        </div>
                        <p>{spec.professional_title || spec.job_title || spec.category || 'Service provider'}</p>
                        <div className="specialist-skill-row">
                          {(skills.length ? skills : ['Professional services']).map((skill) => (
                            <span key={skill}>{skill}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <aside className="specialist-booking-panel">
                      <span>Starting point</span>
                      <strong>{numericRate(spec.in_person_hourly_rate || spec.online_hourly_rate || spec.hourly_rate) ? `${numericRate(spec.in_person_hourly_rate || spec.online_hourly_rate || spec.hourly_rate).toLocaleString()} EGP/hr` : 'Quote based'}</strong>
                      <small>{normalizeEgyptMarket(spec.district_tag)} service area</small>
                    </aside>
                  </div>

                  <div className="specialist-trust-band">
                    <div>
                      <span>Rating</span>
                      <strong>{formatRating(rating)}</strong>
                    </div>
                    <div>
                      <span>Completed</span>
                      <strong>{completedJobs}</strong>
                    </div>
                    <div>
                      <span>Response</span>
                      <strong>{responseSpeedLabel(spec, reputation)}</strong>
                    </div>
                    <div>
                      <span>Verification</span>
                      <strong>{verified ? 'Checked' : 'Pending'}</strong>
                    </div>
                  </div>

                  {spec.bio && <p className="specialist-storefront-bio">{spec.bio}</p>}

                  <div className="specialist-storefront-footer">
                    <SpecialistReputationCard reputation={reputation} compact={true} />
                    {role === 'client' && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                        Post a job for this service
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* ── Create Task Modal ── */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px',
          }}
        >
          <div
            className="premium-card"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '32px',
              background: 'var(--bg-soft)',
              border: '1px solid #334155',
            }}
          >
            <h2 style={{ margin: '0 0 24px 0', fontSize: '22px', color: 'var(--text)' }}>
              Post a new job
            </h2>

            <form onSubmit={handleCreateTask}>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Job title
                </span>
                <input
                  type="text"
                  className="premium-input"
                  placeholder="e.g., Fix my kitchen sink"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Category
                </span>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="premium-input"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Governorate / service market
                </span>
                <select
                  value={newDistrict}
                  onChange={e => setNewDistrict(e.target.value)}
                  className="premium-input"
                >
                  {DISTRICTS.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Budget (EGP)
                </span>
                <input
                  type="number"
                  className="premium-input"
                  placeholder="e.g., 500"
                  value={newBudget}
                  onChange={e => setNewBudget(e.target.value)}
                />
              </label>

              <LocalPriceInsight
                insight={createPriceInsight}
                amount={newBudget}
              />

              <label style={{ display: 'block', marginBottom: 24 }}>
                <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
                  Description
                </span>
                <textarea
                  className="premium-input"
                  placeholder="Describe what you need..."
                  rows="4"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ resize: 'none', fontFamily: 'sans-serif' }}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  className="btn btn-primary"
                  style={{ background: 'var(--gold)' }}
                >
                  {posting ? 'Posting…' : 'Post job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rateModalTask && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="premium-card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '20px',
              background: 'var(--bg-soft)',
              border: '1px solid #334155',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Rate client — {rateModalTask.client_name || 'Client'}</h3>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                Rating
              </span>
              <select value={rateValue} onChange={(e) => setRateValue(e.target.value)} className="premium-input">
                <option value={5}>5 — Excellent</option>
                <option value={4}>4 — Good</option>
                <option value={3}>3 — Okay</option>
                <option value={2}>2 — Poor</option>
                <option value={1}>1 — Terrible</option>
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                Comment (optional)
              </span>
              <textarea
                className="premium-input"
                rows={4}
                value={rateCommentText}
                onChange={(e) => setRateCommentText(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeRateModal} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitClientRating} disabled={ratingSubmitting}>
                {ratingSubmitting ? 'Submitting…' : 'Submit rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Agreement Snapshot Modal ── */}
      <AgreementSnapshot
        agreement={agreementSnapshot}
        isOpen={showAgreementSnapshot}
        onClose={handleAgreementSnapshotClose}
        onAccept={handleAgreementSnapshotAccept}
        loading={agreementLoading}
      />
    </div>
  );
}
