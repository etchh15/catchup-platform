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

export async function createWaitlistSignup(signup) {
  const settings = await fetchPlatformSettings();
  if (settings?.onboarding?.paused) {
    throw new Error(settings.onboarding.reason || 'Beta onboarding is paused right now.');
  }

  const payload = {
    ...signup,
    email: String(signup.email || '').toLowerCase(),
  };

  const { data, error } = await supabase
    .from('waitlist_signups')
    .insert([payload]);

  if (error?.code === '23505') return { ...payload, duplicate: true };
  if (error) throw error;
  return data || payload;
}

export async function fetchPlatformSettings() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['onboarding']);

  if (error) {
    if (isSchemaColumnMissing(error) || error?.code === '42P01') {
      return { onboarding: { paused: false, reason: '' } };
    }
    throw error;
  }

  return (data || []).reduce((settings, row) => {
    settings[row.key] = row.value || {};
    return settings;
  }, { onboarding: { paused: false, reason: '' } });
}

export async function updatePlatformOnboarding({ paused, reason = '' }) {
  const value = {
    paused: Boolean(paused),
    reason,
    updated_at: new Date().toISOString(),
  };

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  const { data, error } = await supabase
    .from('platform_settings')
    .upsert([{ key: 'onboarding', value, updated_at: new Date().toISOString(), updated_by: user?.id || null }], { onConflict: 'key' })
    .select('value')
    .single();

  if (error) throw error;
  return data?.value || value;
}

export async function fetchAdminAlerts({ status = 'pending', limit = 25 } = {}) {
  let query = supabase
    .from('admin_alerts')
    .select('id, event_type, severity, subject, body, payload, recipient_email, delivery_status, delivery_attempts, last_delivery_error, created_at, sent_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('delivery_status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function markAdminAlertReviewed(alertId) {
  const { data, error } = await supabase
    .from('admin_alerts')
    .update({ delivery_status: 'skipped', last_delivery_error: null })
    .eq('id', alertId)
    .select('id, event_type, severity, subject, body, payload, recipient_email, delivery_status, delivery_attempts, last_delivery_error, created_at, sent_at')
    .single();

  if (error) throw error;
  return data;
}

export async function reportCriticalWorkflowFailure(workflow, error, context = {}) {
  const message = error?.message || String(error || 'Unknown error');
  try {
    await supabase.rpc('report_critical_workflow_failure', {
      p_workflow: workflow,
      p_error_message: message,
      p_context: context,
    });
  } catch (reportError) {
    console.warn('Could not report critical workflow failure:', reportError?.message || reportError);
  }
}

async function throwWithWorkflowReport(workflow, error, context = {}) {
  await reportCriticalWorkflowFailure(workflow, error, context);
  throw error;
}
  /**
   * Appointments (Phase 3.2)
   */
export async function submitBid(bidData) {
  const proposal = {
    ...bidData,
    status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
  };

  const { error, data } = await supabase
    .from('bids')
    .upsert([proposal], { onConflict: 'task_id,specialist_id' })
    .select()
    .single();

  if (error) {
    await throwWithWorkflowReport('submit_proposal', error, {
      task_id: bidData?.task_id,
      specialist_id: bidData?.specialist_id,
    });
  }
  return data;
}

export async function expireStaleBidRequests() {
  const { data, error } = await supabase.rpc('expire_stale_bid_requests');

  if (error) {
    if (error?.code === '42883' || String(error?.message || '').includes('expire_stale_bid_requests')) {
      return 0;
    }
    throw error;
  }

  return Number(data || 0);
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
  return { 
    gross, 
    fee: gross * 0.1, 
    net: gross * 0.9,
    agreementId: data?.agreement_id,
    roomId: data?.room_id 
  };
}

/**
 * Task Service
 */
export async function createTask(taskData) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([taskData])
    .select()
    .single();

  if (error) {
    await throwWithWorkflowReport('create_task', error, {
      user_id: taskData?.user_id,
      category: taskData?.category,
      district_tag: taskData?.district_tag,
    });
  }
  return data;
}

export async function updateUserRole(userId, newRole) {
  if (!['client', 'specialist'].includes(newRole)) {
    throw new Error('Only client and specialist roles can be selected from the app.');
  }
  if (newRole === 'specialist') {
    throw new Error('Specialist role requires an ID document upload and admin verification request.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadProfilePhoto(userId, file) {
  if (!userId) throw new Error('User is required to upload a profile photo.');
  if (!file) throw new Error('Choose a profile photo first.');
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Profile photo must be an image file.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Profile photo must be smaller than 5MB.');
  }

  const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg';
  const filePath = `${userId}/avatar-${Date.now()}.${safeExtension}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(filePath);

  const avatarUrl = publicUrlData?.publicUrl;
  if (!avatarUrl) throw new Error('Could not generate profile photo URL.');

  return updateUserProfile(userId, { avatar_url: avatarUrl });
}

export function validateSpecialistIdentityDocumentFile(file) {
  if (!file) throw new Error('Upload an ID document before requesting specialist review.');

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('ID document must be a JPG, PNG, WEBP, or PDF file.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('ID document must be smaller than 10MB.');
  }

  return true;
}

export async function createSpecialistProfileWithIdentityDocument(userId, email, fullName, file) {
  if (!userId) throw new Error('You must be signed in to request specialist review.');
  validateSpecialistIdentityDocumentFile(file);

  const extension = file.name?.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg';
  const filePath = `${userId}/identity-${Date.now()}.${safeExtension}`;

  const { error: uploadError } = await supabase.storage
    .from('specialist-identity-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc('create_specialist_profile_with_identity_document', {
    p_email: email || '',
    p_full_name: fullName || '',
    p_storage_path: filePath,
    p_original_name: file.name || 'identity-document',
    p_mime_type: file.type,
    p_file_size_bytes: file.size,
  });

  if (error) throw error;
  return data;
}

export async function currentUserIsPlatformAdmin() {
  const { data, error } = await supabase.rpc('current_user_is_platform_admin');

  if (error) {
    console.warn('Admin status check unavailable:', error?.message || error);
    return false;
  }

  return Boolean(data);
}

export async function fetchVerificationQueue() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, bio, district_tag, category, professional_title, job_title, phone_number, is_verified, verification_status, verification_note, verification_requested_at, account_status, account_status_note')
    .in('role', ['specialist', 'SPECIALIST'])
    .in('verification_status', ['pending_verification', 'unverified', 'rejected'])
    .order('verification_requested_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error && isSchemaColumnMissing(error)) {
    const fallback = await supabase
      .from('profiles')
      .select('id, email, full_name, role, bio, district_tag, category, professional_title, job_title, phone_number, is_verified, verification_status, verification_note, verification_requested_at')
      .in('role', ['specialist', 'SPECIALIST'])
      .in('verification_status', ['pending_verification', 'unverified', 'rejected'])
      .order('verification_requested_at', { ascending: false, nullsFirst: false })
      .limit(100);

    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((profile) => ({ ...profile, account_status: 'active', account_status_note: null }));
  }
  if (error) throw error;
  const profiles = data ?? [];
  const ids = profiles.map((profile) => profile.id).filter(Boolean);
  if (ids.length === 0) return profiles;

  const { data: documents, error: documentError } = await supabase
    .from('specialist_identity_documents')
    .select('profile_id, original_name, mime_type, file_size_bytes, review_status, uploaded_at, reviewed_at')
    .in('profile_id', ids);

  if (documentError && !isSchemaColumnMissing(documentError) && documentError?.code !== '42P01') {
    throw documentError;
  }

  const documentsByProfileId = (documents || []).reduce((map, document) => {
    map[String(document.profile_id)] = document;
    return map;
  }, {});

  return profiles.map((profile) => ({
    ...profile,
    identity_document: documentsByProfileId[String(profile.id)] || null,
  }));
}

export async function updateSpecialistVerification(profileId, status, note = '') {
  if (!['unverified', 'pending_verification', 'verified', 'rejected'].includes(status)) {
    throw new Error('Unsupported verification status.');
  }

  const updates = {
    verification_status: status,
    verification_note: note,
    verification_reviewed_at: new Date().toISOString(),
    is_verified: status === 'verified',
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select('id, email, full_name, role, bio, district_tag, category, professional_title, job_title, phone_number, is_verified, verification_status, verification_note, verification_requested_at, account_status, account_status_note')
    .single();

  if (error) throw error;

  if (status === 'verified' || status === 'rejected') {
    await supabase
      .from('specialist_identity_documents')
      .update({
        review_status: status === 'verified' ? 'approved' : 'rejected',
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq('profile_id', profileId);
  }

  return data;
}

export async function createSpecialistIdentityDocumentSignedUrl(profileId) {
  const { data: document, error } = await supabase
    .from('specialist_identity_documents')
    .select('storage_path, original_name, mime_type')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw error;
  if (!document?.storage_path) throw new Error('No ID document is attached to this specialist.');

  const { data, error: signedUrlError } = await supabase.storage
    .from('specialist-identity-documents')
    .createSignedUrl(document.storage_path, 60);

  if (signedUrlError) throw signedUrlError;
  return {
    ...document,
    signedUrl: data?.signedUrl,
  };
}

export async function fetchAbuseEvents({ status = 'open', limit = 50 } = {}) {
  let query = supabase
    .from('abuse_events')
    .select('id, actor_id, target_id, target_type, event_type, severity, status, notes, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateAbuseEventStatus(eventId, status) {
  if (!['open', 'reviewing', 'resolved'].includes(status)) {
    throw new Error('Unsupported abuse event status.');
  }

  const updates = {
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('abuse_events')
    .update(updates)
    .eq('id', eventId)
    .select('id, actor_id, target_id, target_type, event_type, severity, status, notes, created_at, resolved_at')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfileAccountStatus(profileId, status, note = '') {
  if (!['active', 'restricted', 'suspended'].includes(status)) {
    throw new Error('Unsupported account status.');
  }

  const { data, error } = await supabase.rpc('update_profile_account_status', {
    p_profile_id: profileId,
    p_status: status,
    p_note: note,
  });

  if (error) throw error;
  return data;
}

export async function fetchWaitlistSignups() {
  const { data, error } = await supabase
    .from('waitlist_signups')
    .select('id, full_name, email, phone_number, city_district, requested_role, source, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function updateWaitlistSignupStatus(signupId, status) {
  const { data, error } = await supabase
    .from('waitlist_signups')
    .update({ status })
    .eq('id', signupId)
    .select('id, full_name, email, phone_number, city_district, requested_role, source, status, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function createUserProfile(userId, role = 'client', email = '', fullName = '') {
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      {
        id: userId,
        role,
        email,
        full_name: fullName,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

function isSchemaColumnMissing(error) {
  const message = String(error?.message || '');
  return error?.code === '42703' || message.includes('does not exist') || message.includes('Could not find');
}

/**
 * Specialist Service
 */
export async function fetchSpecialists(filters = {}) {
  let query = supabase
    .from('profiles')
    .select('id, full_name, bio, district_tag, category, professional_title, job_title, portfolio_images, avatar_url, is_verified, verification_status, hourly_rate, fulfillment_types, metadata, pricing, online_hourly_rate, in_person_hourly_rate, latitude, longitude, service_radius_km')
    .in('role', ['specialist', 'SPECIALIST']);

  if (filters.districtFilter && filters.districtFilter !== 'all') {
    query = query.eq('district_tag', filters.districtFilter);
  }

  const { data, error } = await query.order('full_name', { ascending: true });
  if (error && isSchemaColumnMissing(error)) {
    let fallbackQuery = supabase
      .from('profiles')
      .select('id, full_name, bio, district_tag, category, professional_title, job_title, portfolio_images, avatar_url, is_verified, hourly_rate')
      .in('role', ['specialist', 'SPECIALIST']);

    if (filters.districtFilter && filters.districtFilter !== 'all') {
      fallbackQuery = fallbackQuery.eq('district_tag', filters.districtFilter);
    }

    const fallback = await fallbackQuery.order('full_name', { ascending: true });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((specialist) => ({
      ...specialist,
      verification_status: specialist.is_verified ? 'verified' : 'unverified',
    }));
  }

  if (error) throw error;
  return data ?? [];
}

async function fetchProfilesByIds(ids = []) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, is_verified, district_tag')
    .in('id', uniqueIds);

  if (error) throw error;
  return (data || []).reduce((profilesById, profile) => {
    profilesById[String(profile.id)] = profile;
    return profilesById;
  }, {});
}

async function attachTaskProfiles(tasks = []) {
  const rows = Array.isArray(tasks) ? tasks : [tasks].filter(Boolean);
  const profilesById = await fetchProfilesByIds(
    rows.flatMap((task) => [task.user_id, task.specialist_id])
  );

  const enriched = rows.map((task) => ({
    ...task,
    client: profilesById[String(task.user_id)] || task.client || null,
    assigned_specialist: profilesById[String(task.specialist_id)] || task.assigned_specialist || null,
  }));

  return Array.isArray(tasks) ? enriched : enriched[0] || null;
}

async function attachWorkspaceRoomProfiles(rooms = []) {
  const rows = Array.isArray(rooms) ? rooms : [rooms].filter(Boolean);
  const profilesById = await fetchProfilesByIds(
    rows.flatMap((room) => [room.client_id, room.specialist_id])
  );

  const enriched = rows.map((room) => ({
    ...room,
    tasks: room.tasks
      ? {
          ...room.tasks,
          client: profilesById[String(room.client_id)] || room.tasks.client || null,
          assigned_specialist: profilesById[String(room.specialist_id)] || room.tasks.assigned_specialist || null,
        }
      : room.tasks,
  }));

  return Array.isArray(rooms) ? enriched : enriched[0] || null;
}

async function attachBidProfiles(bids = []) {
  const rows = Array.isArray(bids) ? bids : [bids].filter(Boolean);
  const profilesById = await fetchProfilesByIds(rows.map((bid) => bid.specialist_id));

  const enriched = rows.map((bid) => ({
    ...bid,
    profiles: profilesById[String(bid.specialist_id)] || bid.profiles || null,
  }));

  return Array.isArray(bids) ? enriched : enriched[0] || null;
}

export async function fetchAllActiveTasks() {
  await expireStaleBidRequests();

  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, client_name, title, description, budget, category, district_tag, specialist_id, status, payment_status, payment_note, work_delivered_at, confirmed_by_client_at, created_at, updated_at')
    .not('status', 'eq', 'archived')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error && isSchemaColumnMissing(error)) {
    const fallback = await supabase
      .from('tasks')
      .select('id, user_id, client_name, title, description, budget, category, district_tag, specialist_id, status, work_delivered_at, confirmed_by_client_at, created_at, updated_at')
      .not('status', 'eq', 'archived')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fallback.error) throw fallback.error;
    return attachTaskProfiles((fallback.data ?? []).map((task) => ({
      ...task,
      payment_status: 'unpaid',
      payment_note: null,
    })));
  }

  if (error) throw error;
  return attachTaskProfiles(data ?? []);
}

export async function fetchTaskById(taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, client_name, title, description, budget, category, district_tag, specialist_id, status, payment_status, payment_note, work_delivered_at, confirmed_by_client_at, created_at, updated_at')
    .eq('id', taskId)
    .maybeSingle();

  if (error && isSchemaColumnMissing(error)) {
    const fallback = await supabase
      .from('tasks')
      .select('id, user_id, client_name, title, description, budget, category, district_tag, specialist_id, status, work_delivered_at, confirmed_by_client_at, created_at, updated_at')
      .eq('id', taskId)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    return fallback.data ? attachTaskProfiles({
      ...fallback.data,
      payment_status: 'unpaid',
      payment_note: null,
    }) : null;
  }

  if (error) throw error;
  return data ? attachTaskProfiles(data) : null;
}

export async function fetchAllBids() {
  return fetchMarketplaceBids();
}

export async function fetchMarketplaceBids({ userId = null, role = null } = {}) {
  await expireStaleBidRequests();

  let query = supabase
    .from('bids')
    .select('id, task_id, specialist_id, amount, note, status, created_at, expires_at, accepted_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (userId && role === 'specialist') {
    query = query.eq('specialist_id', userId);
  } else if (userId && role === 'client') {
    const { data: ownedTasks, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .limit(500);

    if (taskError) throw taskError;
    const taskIds = (ownedTasks || []).map((task) => task.id);
    if (taskIds.length === 0) return [];
    query = query.in('task_id', taskIds);
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) throw error;
  return attachBidProfiles(data ?? []);
}

/**
 * Workspace / Room Service
 */
export async function fetchWorkspaceRoomsForUser(userId) {
  const { data, error } = await supabase
    .from('workspace_rooms')
    .select('id, status, created_at, task_id, client_id, specialist_id, tasks(title, budget, category, district_tag)')
    .or(`client_id.eq.${userId},specialist_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachWorkspaceRoomProfiles(data ?? []);
}

export async function fetchWorkspaceRoom(roomId) {
  const { data, error } = await supabase
    .from('workspace_rooms')
    .select('id, status, created_at, task_id, client_id, specialist_id, tasks(title, budget, category, district_tag)')
    .eq('id', roomId)
    .single();

  if (error) throw error;
  return attachWorkspaceRoomProfiles(data);
}

export async function fetchWorkspaceRoomByTask(taskId) {
  const { data, error } = await supabase
    .from('workspace_rooms')
    .select('id, status, created_at, task_id, client_id, specialist_id, tasks(title, budget, category, district_tag)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? attachWorkspaceRoomProfiles(data) : null;
}

async function countRows(table, applyFilters = (query) => query) {
  const query = applyFilters(
    supabase.from(table).select('id', { count: 'exact', head: true })
  );
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function fetchAdminEmergencySignals() {
  const safeCount = async (label, loader) => {
    try {
      return await loader();
    } catch (error) {
      console.warn(`Admin emergency signal unavailable: ${label}`, error?.message || error);
      return null;
    }
  };

  const [
    openDisputes,
    activeRooms,
    staleOpenTasks,
    pendingVerification,
    betaWaitlist,
    openAbuseEvents,
    unpaidAcceptedWork,
  ] = await Promise.all([
    safeCount('open disputes', () => countRows('disputes', (query) => query.in('status', ['open', 'under_review']))),
    safeCount('active rooms', () => countRows('workspace_rooms', (query) => query.eq('status', 'active'))),
    safeCount('stale open tasks', () => {
      const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return countRows('tasks', (query) => query.eq('status', 'open').lt('created_at', staleDate));
    }),
    safeCount('pending verification', () => countRows('profiles', (query) => query.eq('verification_status', 'pending_verification'))),
    safeCount('waitlist', () => countRows('waitlist_signups')),
    safeCount('abuse events', () => countRows('abuse_events', (query) => query.eq('status', 'open'))),
    safeCount('unpaid accepted work', () => countRows('tasks', (query) => query.in('status', ['active', 'completed']).eq('payment_status', 'unpaid'))),
  ]);

  return {
    openDisputes,
    activeRooms,
    staleOpenTasks,
    pendingVerification,
    betaWaitlist,
    openAbuseEvents,
    unpaidAcceptedWork,
  };
}

export async function cancelTask(taskId, userId) {
  const updates = {
    status: 'archived',
  };

  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('user_id', userId)
    .eq('status', 'open');

  if (error) throw error;
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

export async function resolveWorkspaceChatRoomId(roomId, taskId = null) {
  const { data, error } = await supabase
    .rpc('resolve_workspace_chat_room_id', {
      p_room_identifier: roomId ? String(roomId) : null,
      p_task_identifier: taskId ? String(taskId) : null,
    });

  if (error) throw error;
  return data;
}

export async function fetchWorkspaceChatMessages(roomId, taskId = null) {
  const { data, error } = await supabase
    .rpc('fetch_workspace_chat_messages', {
      p_room_identifier: roomId ? String(roomId) : null,
      p_task_identifier: taskId ? String(taskId) : null,
    });

  if (error) throw error;
  return data ?? [];
}

const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function resolveWorkspaceRoomId(roomId, senderId, taskId = null) {
  const normalizedRoomId = String(roomId).trim();
  if (normalizedRoomId.match(uuidRe)) return normalizedRoomId;

  // 1. Fallback to scanning the current user's workspace rooms in client-side memory.
  // This avoids sending numeric legacy identifiers into UUID-typed filters.
  const { data: candidateRooms, error: candidateError } = await supabase
    .from('workspace_rooms')
    .select('id, task_id')
    .or(`client_id.eq.${senderId},specialist_id.eq.${senderId}`);

  if (!candidateError && Array.isArray(candidateRooms)) {
    const match = candidateRooms.find((room) =>
      String(room.id) === normalizedRoomId ||
      String(room.task_id) === normalizedRoomId ||
      (taskId && String(room.task_id) === String(taskId))
    );
    if (match?.id && String(match.id).match(uuidRe)) return match.id;
  }

  // 2. Try UUID task lookup only when the identifier is safe for UUID-typed schemas.
  const safeTaskId = taskId && String(taskId).match(uuidRe) ? String(taskId) : null;
  const { data: roomByTask, error: taskLookupError } = safeTaskId ? await supabase
    .from('workspace_rooms')
    .select('id')
    .eq('task_id', safeTaskId)
    .limit(1)
    .maybeSingle() : { data: null, error: null };

  if (!taskLookupError && roomByTask?.id && String(roomByTask.id).match(uuidRe)) {
    return roomByTask.id;
  }

  // 3. Try direct room lookup only for UUID identifiers.
  const { data: roomById, error: idLookupError } = normalizedRoomId.match(uuidRe) ? await supabase
    .from('workspace_rooms')
    .select('id')
    .eq('id', normalizedRoomId)
    .limit(1)
    .maybeSingle() : { data: null, error: null };

  if (!idLookupError && roomById?.id && String(roomById.id).match(uuidRe)) {
    return roomById.id;
  }

  console.warn('sendWorkspaceMessage: could not resolve workspace room id', {
    roomId: normalizedRoomId,
    taskId,
    candidateError,
    taskLookupError,
    idLookupError,
  });
  throw new Error('This workspace uses a legacy room identifier. Please refresh the workspace and try again.');
}

export async function sendWorkspaceMessage(roomId, senderId, messageText, taskId = null) {
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('send_workspace_message', {
      p_room_identifier: roomId ? String(roomId) : null,
      p_task_identifier: taskId ? String(taskId) : null,
      p_message_text: messageText,
    });

  if (!rpcError) return rpcData;
  if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('send_workspace_message')) {
    await throwWithWorkflowReport('send_workspace_message', rpcError, {
      room_id: roomId,
      task_id: taskId,
      sender_id: senderId,
    });
  }

  await throwWithWorkflowReport('send_workspace_message', new Error('Workspace messaging is not available because the required database RPC is missing.'), {
    room_id: roomId,
    task_id: taskId,
    sender_id: senderId,
  });
}

/**
 * Reviews & Ratings
 */
export async function submitReview(reviewData) {
  const { data: rpcData, error: rpcError } = await supabase.rpc('submit_task_review', {
    p_room_id: reviewData.room_id ? String(reviewData.room_id) : null,
    p_task_id: String(reviewData.task_id),
    p_specialist_id: String(reviewData.specialist_id),
    p_rating_score: Number(reviewData.rating_score),
    p_feedback_text: reviewData.feedback_text || null,
  });

  if (!rpcError) return rpcData;
  if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('submit_task_review')) {
    throw rpcError;
  }

  throw new Error('Review submission is not available because the required database RPC is missing.');
}

export async function fetchReviewByTaskId(taskId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchWorkspaceReview({
  roomId = null,
  taskId = null,
  clientId = null,
  specialistId = null,
} = {}) {
  const { data: rpcData, error: rpcError } = await supabase.rpc('fetch_workspace_review', {
    p_room_id: roomId ? String(roomId) : null,
    p_task_id: taskId ? String(taskId) : null,
    p_client_id: clientId ? String(clientId) : null,
    p_specialist_id: specialistId ? String(specialistId) : null,
  });

  if (!rpcError) return rpcData;
  if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('fetch_workspace_review')) {
    throw rpcError;
  }

  if (taskId) return fetchReviewByTaskId(taskId);
  return null;
}

export async function createCompletionReceipt({ taskId, agreementId = null, receiptType, note = '' }) {
  const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_completion_receipt', {
    p_task_id: taskId ? String(taskId) : null,
    p_agreement_id: agreementId ? String(agreementId) : null,
    p_receipt_type: receiptType || 'service_agreement',
    p_note: note || null,
  });

  if (!rpcError) return rpcData;
  if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('ensure_completion_receipt')) {
    throw rpcError;
  }

  const { data, error } = await supabase
    .from('completion_receipts')
    .insert([{
      task_id: taskId,
      agreement_id: agreementId || null,
      receipt_type: receiptType || 'service_agreement',
      note,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchCompletionReceipt(taskId, receiptType = 'service_agreement') {
  const { data: rpcData, error: rpcError } = await supabase.rpc('fetch_completion_receipt', {
    p_task_id: taskId ? String(taskId) : null,
    p_receipt_type: receiptType || 'service_agreement',
  });

  if (!rpcError) return rpcData;
  if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('fetch_completion_receipt')) {
    throw rpcError;
  }

  const { data, error } = await supabase
    .from('completion_receipts')
    .select('*')
    .eq('task_id', taskId)
    .eq('receipt_type', receiptType || 'service_agreement')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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

export async function createNotification(recipientId, senderId, type, title, message, actionUrl = null, taskId = null) {
  const { data, error } = await supabase
    .rpc('create_app_notification', {
      p_recipient_id: recipientId,
      p_sender_id: senderId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_action_url: actionUrl,
      p_task_id: taskId,
    });

  if (error) throw error;
  return data;
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
  const { error } = await supabase.rpc('recalculate_specialist_reputation', {
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

/**
 * Completion Confirmation Service (Phase 2.2)
 */

/**
 * Dispute Evidence Service (Phase 2.3)
 */
export async function resolveDispute(disputeId, resolution, adminId, amount) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  const { data, error } = await supabase
    .from('dispute_resolutions')
    .insert([
      {
        dispute_id: disputeId,
        resolved_by_admin_id: adminId || user?.id,
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

export async function fetchOpenDisputesForAdmin() {
  const { data, error } = await supabase
    .from('disputes')
    .select('id, task_id, filed_by, reason, reason_category, evidence, status, created_at, updated_at, tasks(id, title, budget, user_id, specialist_id, status)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Appointment Service (Phase 3.2)
 */
/* Appointments consolidated later in file */

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

export async function fetchSpecialistRatings(specialistId, taskIds = []) {
  let query = supabase
    .from('specialist_client_ratings')
    .select('*')
    .eq('specialist_id', specialistId);

  if (Array.isArray(taskIds) && taskIds.length > 0) {
    query = query.in('task_id', taskIds);
  }

  const { data, error } = await query.order('submitted_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function rateClient(specialistId, clientId, taskId, rating, comment) {
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('rate_client_after_completion', {
      p_task_id: taskId,
      p_rating: Number(rating),
      p_comment: comment || null,
    });

  if (!rpcError) return rpcData;
  if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('rate_client_after_completion')) {
    throw rpcError;
  }

  throw new Error('Client review submission is not available because the required database RPC is missing.');
}

export async function calculateClientReputation(clientId) {
  const { error } = await supabase.rpc('recalculate_client_reputation', {
    p_client_id: clientId,
  });

  if (error) throw error;
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
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('mark_task_work_delivered', {
      p_task_id: taskId,
      p_message: message || null,
    });

  let deliveredTask = rpcData;
  if (rpcError) {
    if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('mark_task_work_delivered')) {
      throw rpcError;
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        work_delivered_by: specialistId,
        work_delivered_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('specialist_id', specialistId);

    if (updateError) throw updateError;
    deliveredTask = await fetchTaskById(taskId);
  }

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

  if (logError) console.warn('Failed to write delivery log:', logError);

  // Create notification for client
  const task = deliveredTask || await fetchTaskById(taskId);
  if (task?.user_id) {
    await createNotification(
      task.user_id,
      specialistId,
      'work_delivered',
      `Work on "${task.title}" has been delivered and is ready for inspection`,
      message || 'Work has been delivered and is ready for inspection.',
      `/workspace/${task.id}`,
      taskId
    );
  }

  return task;
}

export async function confirmWorkCompleted(taskId, clientId, message = '') {
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('confirm_task_work_completed', {
      p_task_id: taskId,
      p_message: message || null,
    });

  let completedTask = rpcData;
  if (rpcError) {
    if (rpcError?.code !== '42883' && !String(rpcError?.message || '').includes('confirm_task_work_completed')) {
      throw rpcError;
    }
    throw new Error('Completion confirmation is not available because the required database RPC is missing.');
  }

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

  if (logError) console.warn('Failed to write completion log:', logError);

  // Create notification for specialist
  const task = completedTask || await fetchTaskById(taskId);
  if (task?.specialist_id) {
    await createNotification(
      task.specialist_id,
      clientId,
      'task_completed',
      `Your work on "${task.title}" has been confirmed as complete!`,
      message || 'The client confirmed the work as complete.',
      `/workspace/${task.id}`,
      taskId
    );
  }

  return task;
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
    .rpc('file_task_dispute', {
      p_task_id: taskId,
      p_reason: reason,
      p_reason_category: reasonCategory,
      p_referenced_message_id: messageId,
    });

  if (error) {
    await throwWithWorkflowReport('file_dispute', error, {
      task_id: taskId,
      reason_category: reasonCategory,
      referenced_message_id: messageId,
    });
  }
  return data;
}

export async function uploadDisputeEvidence(disputeId, files) {
  const uploadedEvidence = [];

  for (const file of files) {
    const fileName = `${disputeId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('disputes')
      .upload(fileName, file);

    if (uploadError) {
      await throwWithWorkflowReport('upload_dispute_evidence', uploadError, {
        dispute_id: disputeId,
        filename: file.name,
        file_size: file.size,
        file_type: file.type,
      });
    }

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
    .rpc('append_dispute_evidence', {
      p_dispute_id: disputeId,
      p_evidence: [...existingEvidence, ...uploadedEvidence],
    });

  if (updateError) {
    await throwWithWorkflowReport('append_dispute_evidence', updateError, {
      dispute_id: disputeId,
      uploaded_count: uploadedEvidence.length,
    });
  }
  return uploadedEvidence;
}

export async function respondToDispute(disputeId, responderId, message, evidence = null) {
  const { data, error } = await supabase
    .rpc('respond_to_task_dispute', {
      p_dispute_id: disputeId,
      p_message: message,
      p_evidence: evidence,
    });

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
  const { data, error } = await supabase
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
const normalizeAppointment = (appointment) => {
  if (!appointment) return appointment;
  const status = String(appointment.status || '').toLowerCase();
  return {
    ...appointment,
    status,
    proposed_date: appointment.proposed_date || appointment.starts_at,
    confirmed_date: appointment.confirmed_date,
  };
};

export async function proposeAppointment(
  taskId,
  agreementId,
  proposedDate,
  proposedBy,
  address = '',
  notes = '',
  options = {}
) {
  const { data, error } = await supabase.rpc('reserve_appointment_slot', {
    p_task_id: String(taskId),
    p_agreement_id: agreementId ? String(agreementId) : null,
    p_starts_at: proposedDate,
    p_duration_minutes: Number(options.durationMinutes || options.duration_minutes || 60),
    p_fulfillment_type: options.fulfillmentType || options.fulfillment_type || 'IN_PERSON',
    p_service_address: address || null,
    p_notes: notes || null,
    p_destination_latitude: options.destinationLatitude ?? options.destination_latitude ?? null,
    p_destination_longitude: options.destinationLongitude ?? options.destination_longitude ?? null,
  });

  if (error) throw error;
  return normalizeAppointment(data);
}

export async function confirmAppointment(appointmentId, confirmedBy) {
  const { data, error } = await supabase.rpc('confirm_appointment_slot', {
    p_appointment_id: String(appointmentId),
  });

  if (error) throw error;

  // Auto-complete milestone 2
  const appointment = normalizeAppointment(data);
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

  return appointment;
}

export async function counterProposeAppointment(appointmentId, newDate, proposedBy, address = null, notes = null, options = {}) {
  const existing = await fetchAppointment(appointmentId);
  if (!existing) throw new Error('Appointment not found.');

  return proposeAppointment(
    existing.task_id,
    existing.agreement_id,
    newDate,
    proposedBy,
    address ?? existing.service_address ?? '',
    notes ?? existing.notes ?? '',
    {
      durationMinutes: options.durationMinutes || existing.duration_minutes || 60,
      fulfillmentType: options.fulfillmentType || existing.fulfillment_type || 'IN_PERSON',
      destinationLatitude: options.destinationLatitude ?? existing.destination_latitude ?? null,
      destinationLongitude: options.destinationLongitude ?? existing.destination_longitude ?? null,
    }
  );
}

export async function completeAppointment(appointmentId) {
  const { data, error } = await supabase.rpc('complete_appointment_slot', {
    p_appointment_id: String(appointmentId),
  });

  if (error) throw error;
  return normalizeAppointment(data);
}

export async function cancelAppointment(appointmentId, reason = '') {
  const { data, error } = await supabase.rpc('cancel_appointment_slot', {
    p_appointment_id: String(appointmentId),
    p_reason: reason || null,
  });

  if (error) throw error;
  return normalizeAppointment(data);
}

export async function fetchAppointment(appointmentId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) throw error;
  return normalizeAppointment(data);
}

export async function fetchAppointmentByTask(taskId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return normalizeAppointment(data);
}
