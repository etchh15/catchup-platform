import { supabase } from '../supabaseClient';

/**
 * User & Auth Service
 */
export async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchUserRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role ?? null;
}

export async function createUserProfile(userId, role, email, fullName) {
  const name = fullName || email?.split('@')[0] || 'User';

  // Create profile entry
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      role,
      email,
      full_name: name,
    })
    .select()
    .single();

  if (error) throw error;

  // Create role-specific table entry (FKs reference profiles.id)
  if (role === 'client') {
    const { error: clientErr } = await supabase
      .from('clients')
      .upsert([{ id: userId, full_name: name, city_district: 'Tala' }]);
    if (clientErr) throw clientErr;
  } else if (role === 'specialist') {
    const { error: specialistErr } = await supabase
      .from('specialists')
      .upsert([
        {
          id: userId,
          business_name: name,
          profession_category: 'General',
          is_verified: false,
        },
      ]);
    if (specialistErr) throw specialistErr;
  }

  return data;
}

export async function updateUserRole(userId, newRole) {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Task Service
 */
export async function fetchTasks(filters = {}) {
  let query = supabase.from('tasks').select('*');

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.districtFilter && filters.districtFilter !== 'all') {
    query = query.eq('district_tag', filters.districtFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchAllActiveTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .not('status', 'in', '(archived,expired)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createTask(taskData) {
  const { error, data } = await supabase
    .from('tasks')
    .insert([taskData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTask(taskId, updates) {
  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId);

  if (error) throw error;
}

/**
 * Bid Service
 */
export async function fetchAllBids() {
  const { data, error } = await supabase
    .from('bids')
    .select('*, profiles!specialist_id(full_name, category, professional_title)')
    .order('created_at', { ascending: false });

  if (error) {
    const { data: fallback } = await supabase.from('bids').select('*').order('created_at', { ascending: false });
    return fallback ?? [];
  }

  return data ?? [];
}

export async function fetchBidsForTask(taskId) {
  const { data, error } = await supabase
    .from('bids')
    .select('*, profiles!specialist_id(full_name, category, professional_title)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function submitBid(bidData) {
  const { error, data } = await supabase
    .from('bids')
    .insert([bidData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBidStatus(bidId, status) {
  const { error } = await supabase
    .from('bids')
    .update({ status })
    .eq('id', bidId);

  if (error) throw error;
}

export async function acceptBid(taskId, bidId, specialistId, bidAmount) {
  // Atomic acceptance is handled in DB to avoid partial writes and RLS mismatch.
  const { data, error } = await supabase.rpc('accept_bid', {
    p_task_id: taskId,
    p_bid_id: bidId,
  });

  if (error) throw error;

  const gross = Number(data?.amount ?? bidAmount ?? 0);
  return { gross, fee: gross * 0.1, net: gross * 0.9 };
}

/**
 * Specialist Service
 */
export async function fetchSpecialists(filters = {}) {
  let query = supabase.from('profiles').select('*').eq('role', 'specialist');

  if (filters.districtFilter && filters.districtFilter !== 'all') {
    query = query.eq('district_tag', filters.districtFilter);
  }

  const { data, error } = await query.order('full_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Workspace / Room Service
 */
export async function fetchWorkspaceRoomsForUser(userId) {
  const { data, error } = await supabase
    .from('workspace_rooms')
    .select('id, status, created_at, task_id, client_id, specialist_id, tasks(title, budget)')
    .or(`client_id.eq.${userId},specialist_id.eq.${userId}`);

  if (error) throw error;
  return data ?? [];
}

export async function fetchWorkspaceRoom(roomId) {
  const { data, error } = await supabase
    .from('workspace_rooms')
    .select('id, status, created_at, task_id, client_id, specialist_id, tasks(title, budget)')
    .eq('id', roomId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkspaceRoomStatus(roomId, status, disputeData = null) {
  const updates = { status };
  if (disputeData) {
    updates.dispute_initiated_by = disputeData.initiatedBy;
    updates.dispute_reason = disputeData.reason;
  }

  const { error } = await supabase
    .from('workspace_rooms')
    .update(updates)
    .eq('id', roomId);

  if (error) throw error;
}

/**
 * Workspace Messages
 */
export async function fetchWorkspaceMessages(roomId) {
  const { data, error } = await supabase
    .from('workspace_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendWorkspaceMessage(roomId, senderId, messageText) {
  const { error, data } = await supabase
    .from('workspace_messages')
    .insert([{
      room_id: roomId,
      sender_id: senderId,
      message_text: messageText,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Reviews & Ratings
 */
export async function submitReview(reviewData) {
  const { error, data } = await supabase
    .from('reviews')
    .insert([reviewData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchSpecialistContact(specialistId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone_number, email, email_address')
    .eq('id', specialistId)
    .single();

  if (error) throw error;
  return {
    ...data,
    email_address: data.email_address ?? data.email ?? null,
  };
}

/**
 * Realtime Subscriptions
 */
export function subscribeToTasks(callback) {
  const channel = supabase
    .channel('rt-tasks')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToBids(callback) {
  const channel = supabase
    .channel('rt-bids')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToWorkspaceMessages(roomId, callback) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workspace_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Notification Service
 */
export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function fetchNotificationPreferences(userId) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // Create default preferences if not exists
    const { data: newPref, error: insertError } = await supabase
      .from('notification_preferences')
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (insertError) throw insertError;
    return newPref;
  }

  return data;
}

export async function updateNotificationPreferences(userId, preferences) {
  const { error } = await supabase
    .from('notification_preferences')
    .update(preferences)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function markNotificationAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

export async function deleteNotification(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

export async function clearAllNotifications(userId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('recipient_id', userId);

  if (error) throw error;
}

/**
 * Specialist Reputation Service
 */
export async function fetchSpecialistReputation(specialistId) {
  const { data, error } = await supabase
    .from('specialist_reputation')
    .select('*')
    .eq('specialist_id', specialistId)
    .maybeSingle();

  if (error) {
    console.warn('Reputation not found, returning defaults');
    return {
      specialist_id: specialistId,
      total_completed_jobs: 0,
      total_reviews: 0,
      average_rating: 0,
      response_time_hours: 0,
      is_verified: false,
      service_categories: [],
      service_areas: [],
      profile_completeness: 0,
    };
  }

  return data;
}

export async function fetchMultipleSpecialistReputations(specialistIds) {
  if (!specialistIds || specialistIds.length === 0) return {};

  const { data, error } = await supabase
    .from('specialist_reputation')
    .select('*')
    .in('specialist_id', specialistIds);

  if (error) throw error;

  // Convert to object keyed by specialist_id
  const reputationMap = {};
  (data || []).forEach(rep => {
    reputationMap[rep.specialist_id] = rep;
  });

  return reputationMap;
}

export async function calculateSpecialistReputation(specialistId) {
  const { error } = await supabase.rpc('calculate_specialist_reputation', {
    p_specialist_id: specialistId,
  });

  if (error) throw error;
}

/**
 * Contact Visibility Service
 */
export async function revealContactDetails(roomId) {
  const { error } = await supabase
    .from('workspace_rooms')
    .update({ contact_revealed_at: new Date().toISOString() })
    .eq('id', roomId)
    .is('contact_revealed_at', null);

  if (error) throw error;
}

export async function logContactAccess(viewerId, targetId, roomId) {
  const { error } = await supabase
    .from('contact_access_log')
    .insert([
      {
        viewer_id: viewerId,
        target_id: targetId,
        room_id: roomId,
      },
    ]);

  if (error) {
    console.warn('Could not log contact access:', error);
    // Don't throw - logging failure shouldn't break the flow
  }
}

/**
 * Agreement Service (Phase 2.1)
 */
export async function fetchOrCreateAgreement(taskId, specialistId, clientId, amount, proposalNote) {
  // Check if agreement already exists
  const { data: existing, error: fetchError } = await supabase
    .from('agreements')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
  if (existing) return existing;

  // Create new agreement
  const expectedDeliveryDate = new Date();
  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7);

  const { data, error } = await supabase
    .from('agreements')
    .insert([
      {
        task_id: taskId,
        specialist_id: specialistId,
        client_id: clientId,
        agreed_amount: amount,
        proposal_note: proposalNote,
        expected_delivery_date: expectedDeliveryDate.toISOString().split('T')[0],
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAgreement(agreementId) {
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('id', agreementId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateAgreement(agreementId, updates) {
  const { data, error } = await supabase
    .from('agreements')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agreementId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Completion Confirmation Service (Phase 2.2)
 */
export async function markWorkDelivered(taskId, specialistId, message) {
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      work_delivered_by: specialistId,
      work_delivered_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (updateError) throw updateError;

  // Log action
  const { error: logError } = await supabase
    .from('completion_log')
    .insert([
      {
        task_id: taskId,
        action: 'work_delivered',
        actor_id: specialistId,
        message,
      },
    ]);

  if (logError) console.warn('Failed to log work delivery:', logError);
}

export async function confirmWorkCompleted(taskId, clientId, message) {
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      confirmed_by_client: clientId,
      confirmed_by_client_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', taskId);

  if (updateError) throw updateError;

  // Log action
  const { error: logError } = await supabase
    .from('completion_log')
    .insert([
      {
        task_id: taskId,
        action: 'work_confirmed',
        actor_id: clientId,
        message,
      },
    ]);

  if (logError) console.warn('Failed to log work confirmation:', logError);
}

export async function fetchCompletionLog(taskId) {
  const { data, error } = await supabase
    .from('completion_log')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Dispute Evidence Service (Phase 2.3)
 */
export async function fileDispute(taskId, reason, reasonCategory, messageId) {
  // Create dispute (assumes disputes table exists from original schema)
  const { data, error } = await supabase
    .from('disputes')
    .insert([
      {
        task_id: taskId,
        reason,
        reason_category: reasonCategory,
        referenced_message_id: messageId,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadDisputeEvidence(disputeId, files) {
  const uploadedEvidence = [];

  for (const file of files) {
    const filename = `${Date.now()}-${file.name}`;
    const filePath = `disputes/${disputeId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('public')
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('public').getPublicUrl(filePath);
    uploadedEvidence.push({
      type: 'image',
      url: data.publicUrl,
      uploaded_at: new Date().toISOString(),
    });
  }

  // Update dispute with evidence
  const { error: updateError } = await supabase
    .from('disputes')
    .update({
      evidence: uploadedEvidence,
    })
    .eq('id', disputeId);

  if (updateError) throw updateError;
  return uploadedEvidence;
}

export async function respondToDispute(disputeId, responderId, message, evidence) {
  const { data, error } = await supabase
    .from('dispute_responses')
    .insert([
      {
        dispute_id: disputeId,
        responder_id: responderId,
        message,
        evidence: evidence || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resolveDispute(disputeId, resolution, adminId, amount) {
  const { data, error } = await supabase
    .from('dispute_resolutions')
    .insert([
      {
        dispute_id: disputeId,
        resolved_by_admin_id: adminId,
        resolution,
        amount,
        resolved_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Milestone Service (Phase 3.1)
 */
export async function createMilestones(agreementId) {
  const milestones = [
    { milestone_number: 1, name: 'Request Confirmed', description: 'Initial task posted' },
    { milestone_number: 2, name: 'Work Scheduled', description: 'Appointment confirmed' },
    { milestone_number: 3, name: 'Work Started', description: 'Specialist begins service' },
    { milestone_number: 4, name: 'Client Inspected', description: 'Client reviews quality' },
    { milestone_number: 5, name: 'Completed', description: 'Both parties agree work is done' },
  ];

  const { error } = await supabase
    .from('agreement_milestones')
    .insert(
      milestones.map(m => ({
        agreement_id: agreementId,
        ...m,
        status: 'pending',
      }))
    );

  if (error) throw error;

  // Auto-complete milestone 1
  await supabase
    .from('agreement_milestones')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('agreement_id', agreementId)
    .eq('milestone_number', 1);
}

export async function completeMilestone(milestoneId, completedBy, notes) {
  const { error } = await supabase
    .from('agreement_milestones')
    .update({
      status: 'completed',
      completed_by: completedBy,
      completed_at: new Date().toISOString(),
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', milestoneId);

  if (error) throw error;
}

export async function fetchMilestones(agreementId) {
  const { data, error } = await supabase
    .from('agreement_milestones')
    .select('*')
    .eq('agreement_id', agreementId)
    .order('milestone_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Appointment Service (Phase 3.2)
 */
export async function proposeAppointment(taskId, agreementId, proposedDate, address, proposedBy) {
  const { data, error } = await supabase
    .from('appointments')
    .insert([
      {
        task_id: taskId,
        agreement_id: agreementId,
        proposed_date: proposedDate,
        proposed_by: proposedBy,
        service_address: address,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function confirmAppointment(appointmentId, confirmedBy) {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'confirmed',
      confirmed_by: confirmedBy,
      confirmed_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;

  // Auto-complete milestone 2
  if (data.agreement_id) {
    await supabase
      .from('agreement_milestones')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('agreement_id', data.agreement_id)
      .eq('milestone_number', 2);
  }

  return data;
}

export async function counterProposeAppointment(appointmentId, newDate) {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      proposed_date: newDate,
      status: 'rescheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAppointment(appointmentId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchTaskAppointment(taskId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Client Reputation Service (Phase 3.3)
 */
export async function fetchClientReputation(clientId) {
  const { data, error } = await supabase
    .from('client_reputation')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;

  // Return default if not found
  if (!data) {
    return {
      client_id: clientId,
      total_jobs_posted: 0,
      total_jobs_completed: 0,
      completion_rate: 0,
      average_acceptance_rate: 0,
      phone_verified: false,
      email_verified: false,
      average_rating_from_specialists: 0,
      total_ratings_given: 0,
      average_response_time_hours: 0,
    };
  }

  return data;
}

export async function rateClient(specialistId, clientId, taskId, rating, comment) {
  const { data, error } = await supabase
    .from('specialist_client_ratings')
    .insert([
      {
        specialist_id: specialistId,
        client_id: clientId,
        task_id: taskId,
        rating,
        comment,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // Trigger client reputation calculation
  await calculateClientReputation(clientId);
  return data;
}

export async function calculateClientReputation(clientId) {
  // This would normally be a database function/trigger
  // For now, fetch fresh data from specialist_client_ratings
  const { data: ratings, error: ratingsError } = await supabase
    .from('specialist_client_ratings')
    .select('rating')
    .eq('client_id', clientId);

  if (ratingsError) {
    console.warn('Failed to calculate client reputation:', ratingsError);
    return;
  }

  const avgRating = ratings && ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : 0;

  // Update or create client reputation record
  const { error: updateError } = await supabase
    .from('client_reputation')
    .upsert(
      {
        client_id: clientId,
        average_rating_from_specialists: parseFloat(avgRating),
        total_ratings_given: ratings?.length || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' }
    );

  if (updateError) console.warn('Failed to update client reputation:', updateError);
}

/**
 * Agreements & Contracts (Phase 2.1)
 */
export async function fetchOrCreateAgreement(taskId, specialistId, clientId, agreedAmount, proposalNote) {
  // Check if agreement already exists
  const { data: existing } = await supabase
    .from('agreements')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Create new agreement
  const expectedDeliveryDate = new Date();
  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 7);

  const { data, error } = await supabase
    .from('agreements')
    .insert([
      {
        task_id: taskId,
        specialist_id: specialistId,
        client_id: clientId,
        agreed_amount: agreedAmount,
        proposal_note: proposalNote,
        expected_delivery_date: expectedDeliveryDate.toISOString().split('T')[0],
        contract_data: {
          created_at: new Date().toISOString(),
          version: '1.0',
        },
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAgreement(agreementId) {
  const { data, error } = await supabase
    .from('agreements')
    .select('*')
    .eq('id', agreementId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateAgreement(agreementId, updates) {
  const { data, error } = await supabase
    .from('agreements')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agreementId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToAgreement(taskId, callback) {
  const subscription = supabase
    .channel(`agreements:task_id=eq.${taskId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agreements',
        filter: `task_id=eq.${taskId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    subscription?.unsubscribe();
  };
}

/**
 * Completion & Delivery (Phase 2.2)
 */
export async function markWorkDelivered(taskId, specialistId, message = '') {
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      work_delivered_by: specialistId,
      work_delivered_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (updateError) throw updateError;

  // Log in completion log
  const { error: logError } = await supabase
    .from('completion_log')
    .insert([
      {
        task_id: taskId,
        action: 'work_delivered',
        actor_id: specialistId,
        message,
      },
    ]);

  if (logError) throw logError;

  // Create notification for client
  const task = await fetchTaskById(taskId);
  if (task?.user_id) {
    await createNotification(
      task.user_id,
      specialistId,
      'work_delivered',
      `Work on "${task.title}" has been delivered and is ready for inspection`,
      `/workspace/${task.id}`,
      taskId
    );
  }
}

export async function confirmWorkCompleted(taskId, clientId, message = '') {
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      confirmed_by_client: clientId,
      confirmed_by_client_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', taskId);

  if (updateError) throw updateError;

  // Log in completion log
  const { error: logError } = await supabase
    .from('completion_log')
    .insert([
      {
        task_id: taskId,
        action: 'work_confirmed',
        actor_id: clientId,
        message,
      },
    ]);

  if (logError) throw logError;

  // Create notification for specialist
  const task = await fetchTaskById(taskId);
  if (task?.specialist_id) {
    await createNotification(
      task.specialist_id,
      clientId,
      'task_completed',
      `Your work on "${task.title}" has been confirmed as complete!`,
      `/workspace/${task.id}`,
      taskId
    );
  }
}

export async function fetchCompletionLog(taskId) {
  const { data, error } = await supabase
    .from('completion_log')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Disputes & Evidence (Phase 2.3)
 */
export async function fileDispute(taskId, reason, reasonCategory, messageId = null) {
  const { data, error } = await supabase
    .from('disputes')
    .insert([
      {
        task_id: taskId,
        filed_by: (await supabase.auth.getUser()).data.user?.id,
        reason,
        reason_category: reasonCategory,
        referenced_message_id: messageId,
        status: 'open',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadDisputeEvidence(disputeId, files) {
  const uploadedEvidence = [];

  for (const file of files) {
    const fileName = `${disputeId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('disputes')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('disputes').getPublicUrl(fileName);
    uploadedEvidence.push({
      type: 'image',
      url: data.publicUrl,
      uploaded_at: new Date().toISOString(),
      filename: file.name,
    });
  }

  // Update dispute with evidence
  const { data: dispute } = await supabase
    .from('disputes')
    .select('evidence')
    .eq('id', disputeId)
    .single();

  const existingEvidence = dispute?.evidence || [];
  const { error: updateError } = await supabase
    .from('disputes')
    .update({
      evidence: [...existingEvidence, ...uploadedEvidence],
    })
    .eq('id', disputeId);

  if (updateError) throw updateError;
  return uploadedEvidence;
}

export async function respondToDispute(disputeId, responderId, message, evidence = null) {
  const { data, error } = await supabase
    .from('dispute_responses')
    .insert([
      {
        dispute_id: disputeId,
        responder_id: responderId,
        message,
        evidence,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Milestones (Phase 3.1)
 */
export async function createMilestones(agreementId) {
  const milestones = [
    { milestone_number: 1, name: 'Request Confirmed', description: 'Task posted' },
    { milestone_number: 2, name: 'Work Scheduled', description: 'Appointment confirmed' },
    { milestone_number: 3, name: 'Work Started', description: 'Specialist begins work' },
    { milestone_number: 4, name: 'Client Inspection', description: 'Client reviews quality' },
    { milestone_number: 5, name: 'Completed', description: 'Both parties agree work is done' },
  ];

  const insertData = milestones.map((m) => ({
    agreement_id: agreementId,
    milestone_number: m.milestone_number,
    name: m.name,
    description: m.description,
    status: m.milestone_number === 1 ? 'completed' : 'pending',
    completed_at: m.milestone_number === 1 ? new Date().toISOString() : null,
  }));

  const { data, error } = await supabase
    .from('agreement_milestones')
    .insert(insertData)
    .select();

  if (error) throw error;
  return data;
}

export async function completeMilestone(milestoneId, completedBy, notes = '') {
  const { data, error } = await supabase
    .from('agreement_milestones')
    .update({
      status: 'completed',
      completed_by: completedBy,
      completed_at: new Date().toISOString(),
      notes,
    })
    .eq('id', milestoneId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMilestones(agreementId) {
  const { data, error } = supabase
    .from('agreement_milestones')
    .select('*')
    .eq('agreement_id', agreementId)
    .order('milestone_number', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Appointments (Phase 3.2)
 */
export async function proposeAppointment(taskId, agreementId, proposedDate, proposedBy, address = '', notes = '') {
  const { data, error } = await supabase
    .from('appointments')
    .insert([
      {
        task_id: taskId,
        agreement_id: agreementId,
        proposed_date: proposedDate,
        proposed_by: proposedBy,
        service_address: address,
        notes,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function confirmAppointment(appointmentId, confirmedBy) {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'confirmed',
      confirmed_by: confirmedBy,
      confirmed_date: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;

  // Auto-complete milestone 2
  const appointment = data;
  if (appointment?.agreement_id) {
    const { data: milestones } = await supabase
      .from('agreement_milestones')
      .select('id')
      .eq('agreement_id', appointment.agreement_id)
      .eq('milestone_number', 2)
      .single();

    if (milestones) {
      await completeMilestone(milestones.id, confirmedBy, 'Appointment confirmed');
    }
  }

  return data;
}

export async function fetchAppointment(appointmentId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchAppointmentByTask(taskId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
