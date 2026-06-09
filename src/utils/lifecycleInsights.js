export function clampRating(value, min = 0, max = 5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export function buildTrustTimeline({
  task,
  agreement,
  appointment,
  completion,
  receipt,
  dispute,
  milestones = [],
  review,
} = {}) {
  const milestoneByName = new Map(
    (milestones || []).map((m) => [String(m.name || '').toLowerCase(), m])
  );
  const appointmentDate = appointment?.confirmed_date || appointment?.proposed_date;
  const receiptDate = receipt?.created_at || receipt?.generated_at;
  const isClosed = Boolean(review?.id || task?.status === 'completed');
  const closeoutDate = review?.created_at || task?.confirmed_by_client_at || task?.updated_at;

  const steps = [
    {
      key: 'posted',
      label: 'Job posted',
      date: task?.created_at,
      complete: Boolean(task?.created_at || task?.id),
    },
    {
      key: 'accepted',
      label: 'Proposal accepted',
      date: agreement?.accepted_at || task?.updated_at,
      complete: Boolean(agreement?.id || task?.agreement_id || task?.status === 'active' || task?.status === 'completed'),
    },
    {
      key: 'agreement',
      label: 'Agreement created',
      date: agreement?.created_at || agreement?.accepted_at || closeoutDate,
      complete: Boolean(agreement?.id || isClosed),
    },
    {
      key: 'visit',
      label: appointment?.status === 'pending' || appointment?.status === 'rescheduled'
        ? 'Visit proposed'
        : 'Visit scheduled',
      date: appointmentDate || closeoutDate,
      complete: appointment?.status === 'confirmed' || isClosed,
      active: Boolean(appointment && appointment.status !== 'confirmed'),
    },
    {
      key: 'delivered',
      label: 'Work delivered',
      date: completion?.workDeliveredAt || task?.work_delivered_at || milestoneByName.get('client inspection')?.completed_at,
      complete: Boolean(completion?.workDeliveredAt || task?.work_delivered_at),
    },
    {
      key: 'confirmed',
      label: 'Client confirmed',
      date: completion?.confirmedByClientAt || task?.confirmed_by_client_at,
      complete: Boolean(completion?.confirmedByClientAt || task?.confirmed_by_client_at || task?.status === 'completed'),
    },
    {
      key: 'receipt',
      label: receipt?.id || receiptDate || isClosed ? 'Receipt ready' : 'Receipt generated',
      date: receiptDate || closeoutDate,
      complete: Boolean(receipt?.id || receiptDate || isClosed),
    },
  ];

  if (dispute) {
    steps.push({
      key: 'dispute',
      label: dispute.status === 'resolved' ? 'Dispute resolved' : 'Dispute opened',
      date: dispute.resolved_at || dispute.created_at,
      complete: dispute.status === 'resolved',
      active: dispute.status !== 'resolved',
      tone: dispute.status === 'resolved' ? 'done' : 'risk',
    });
  }

  const firstIncompleteIndex = steps.findIndex((step) => !step.complete && !step.active);
  return steps.map((step, index) => ({
    ...step,
    state: step.active
      ? 'current'
      : step.complete
      ? 'completed'
      : index === firstIncompleteIndex
      ? 'current'
      : 'pending',
  }));
}

export function getSmartNextAction({
  role,
  task,
  agreement,
  appointment,
  completion,
  review,
  dispute,
  receipt,
} = {}) {
  if (dispute && dispute.status !== 'resolved') {
    return { label: 'Respond to dispute', tone: 'risk' };
  }

  const isSpecialist = role === 'specialist';
  const isClient = role === 'client';
  const hasDelivered = Boolean(completion?.workDeliveredAt || task?.work_delivered_at);
  const isConfirmed = Boolean(completion?.confirmedByClientAt || task?.confirmed_by_client_at || task?.status === 'completed');
  const hasReview = Boolean(review?.id);

  if (hasReview || (isConfirmed && !isClient)) {
    return {
      label: 'Work is done',
      detail: hasReview ? 'Review sealed and reputation updated.' : 'Completion confirmed and workspace closed.',
      tone: 'completed',
    };
  }

  if (!appointment && isSpecialist && agreement) {
    return { label: 'Propose visit date', tone: 'primary' };
  }

  if (appointment && appointment.status !== 'confirmed') {
    if (isClient) return { label: 'Confirm or counter-propose appointment', tone: 'primary' };
    return { label: 'Review appointment counter-proposal', tone: 'primary' };
  }

  if (appointment?.status === 'confirmed' && !hasDelivered && isSpecialist) {
    return { label: 'Mark work delivered', tone: 'primary' };
  }

  if (hasDelivered && !isConfirmed && isClient) {
    return { label: 'Confirm completion', tone: 'primary' };
  }

  if (isConfirmed && !hasReview && isClient) {
    return { label: 'Leave review', tone: 'primary' };
  }

  if ((receipt || isConfirmed) && agreement) {
    return { label: 'Download receipt', tone: 'neutral' };
  }

  return { label: 'Keep the workspace updated', tone: 'neutral' };
}

export function getLocalPriceInsight({ tasks = [], bids = [], category, district, amount } = {}) {
  const comparableTasks = (tasks || []).filter((task) => {
    const categoryMatch = String(task.category || '').toLowerCase() === String(category || '').toLowerCase();
    const districtMatch = String(task.district_tag || '').toLowerCase() === String(district || '').toLowerCase();
    return categoryMatch && districtMatch;
  });

  const comparableTaskIds = new Set(comparableTasks.map((task) => task.id));
  const comparableBids = (bids || []).filter((bid) => comparableTaskIds.has(bid.task_id) && Number.isFinite(Number(bid.amount)));
  const acceptedBids = comparableBids.filter((bid) => bid.status === 'accepted');
  const acceptedAmounts = acceptedBids.map((bid) => Number(bid.amount));
  const allBidAmounts = comparableBids.map((bid) => Number(bid.amount));
  const budgets = comparableTasks.map((task) => Number(task.budget)).filter(Number.isFinite);

  const average = acceptedAmounts.length
    ? acceptedAmounts.reduce((sum, value) => sum + value, 0) / acceptedAmounts.length
    : null;
  const sourceAmounts = acceptedAmounts.length ? acceptedAmounts : allBidAmounts;
  const low = sourceAmounts.length ? Math.min(...sourceAmounts) : null;
  const high = sourceAmounts.length ? Math.max(...sourceAmounts) : null;
  const budgetLow = budgets.length ? Math.min(...budgets) : null;
  const budgetHigh = budgets.length ? Math.max(...budgets) : null;
  const numericAmount = Number(amount);

  let comparison = null;
  if (Number.isFinite(numericAmount) && average) {
    if (numericAmount < average * 0.9) comparison = 'below';
    else if (numericAmount > average * 1.1) comparison = 'above';
    else comparison = 'near';
  }

  return {
    category,
    district,
    average,
    low,
    high,
    budgetLow,
    budgetHigh,
    comparableJobs: comparableTasks.length,
    comparableBids: comparableBids.length,
    acceptedCount: acceptedAmounts.length,
    comparison,
    limited: comparableTasks.length < 2 || sourceAmounts.length < 2,
  };
}

export function getClientSeriousnessSummary(reputation) {
  const posted = Number(reputation?.total_jobs_posted || 0);
  const completed = Number(reputation?.total_jobs_completed || 0);
  const completionRate = Number(reputation?.completion_rate || 0);
  const rating = Number(reputation?.average_rating_from_specialists || 0);
  const verified = Boolean(reputation?.phone_verified || reputation?.email_verified);

  const badges = [];
  if (posted === 0) badges.push('New client');
  if (completed > 0) badges.push(`${completed} completed job${completed === 1 ? '' : 's'}`);
  if (completionRate >= 80 && posted >= 2) badges.push('Reliable client');
  if (completionRate >= 80) badges.push('Low cancellation history');
  if (verified) badges.push('Verified contact');
  if (rating >= 4) badges.push(`${rating.toFixed(1)} specialist rating`);

  return badges.slice(0, 4);
}
