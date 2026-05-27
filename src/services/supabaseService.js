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

  // Create role-specific table entry
  if (role === 'client') {
    await supabase
      .from('clients')
      .upsert([{ id: userId, full_name: name, city_district: 'Tala' }]);
  } else {
    await supabase
      .from('specialists')
      .upsert([{ id: userId, business_name: name, profession_category: 'General', is_verified: false }]);
  }

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
  // Update bid status
  await updateBidStatus(bidId, 'accepted');

  // Update task status
  await updateTask(taskId, { status: 'active', specialist_id: specialistId });

  // Create workspace room
  const task = await supabase
    .from('tasks')
    .select('user_id')
    .eq('id', taskId)
    .single()
    .then(r => r.data);

  if (task) {
    await supabase
      .from('workspace_rooms')
      .insert([{
        task_id: taskId,
        client_id: task.user_id,
        specialist_id: specialistId,
        status: 'active',
      }]);
  }

  return { gross: bidAmount, fee: bidAmount * 0.1, net: bidAmount * 0.9 };
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
