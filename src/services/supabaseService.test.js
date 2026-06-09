import { afterEach, expect, test, vi } from 'vitest';
import {
  cancelTask,
  createCompletionReceipt,
  createNotification,
  expireStaleBidRequests,
  fetchCompletionReceipt,
  fetchMarketplaceBids,
  fetchReviewByTaskId,
  fetchWorkspaceReview,
  fetchWorkspaceRoomByTask,
  rateClient,
  sendWorkspaceMessage,
  submitReview,
  updateUserRole,
  submitBid,
} from './supabaseService';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

test('createNotification maps frontend fields to the database RPC contract', async () => {
  const notification = { id: 'notification-1', message: 'Delivered', action_url: '/workspace/task-1' };
  supabase.rpc.mockResolvedValue({ data: notification, error: null });

  await expect(
    createNotification(
      'recipient-1',
      'sender-1',
      'work_delivered',
      'Work delivered',
      'Delivered',
      '/workspace/task-1',
      'task-1'
    )
  ).resolves.toEqual(notification);

  expect(supabase.rpc).toHaveBeenCalledWith('create_app_notification', {
    p_recipient_id: 'recipient-1',
    p_sender_id: 'sender-1',
    p_type: 'work_delivered',
    p_title: 'Work delivered',
    p_message: 'Delivered',
    p_action_url: '/workspace/task-1',
    p_task_id: 'task-1',
  });
});

test('sendWorkspaceMessage uses the room resolver RPC with room and task identifiers', async () => {
  const message = { id: 'message-1', message_text: 'Hello' };
  supabase.rpc.mockResolvedValue({ data: message, error: null });

  await expect(
    sendWorkspaceMessage('20', 'sender-1', 'Hello', '20')
  ).resolves.toEqual(message);

  expect(supabase.rpc).toHaveBeenCalledWith('send_workspace_message', {
    p_room_identifier: '20',
    p_task_identifier: '20',
    p_message_text: 'Hello',
  });
});

test('updateUserRole refuses privileged roles in the browser service', async () => {
  await expect(updateUserRole('user-1', 'admin')).rejects.toThrow(/Only client and specialist roles/i);
  expect(supabase.from).not.toHaveBeenCalled();
});

test('fetchWorkspaceRoomByTask uses latest task-scoped room instead of assuming one client-specialist room', async () => {
  const room = { id: 'room-latest', task_id: 'task-2' };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve({ data: room, error: null })),
  };
  supabase.from.mockReturnValue(query);

  await expect(fetchWorkspaceRoomByTask('task-2')).resolves.toEqual(room);

  expect(supabase.from).toHaveBeenCalledWith('workspace_rooms');
  expect(query.eq).toHaveBeenCalledWith('task_id', 'task-2');
  expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  expect(query.limit).toHaveBeenCalledWith(1);
});

test('fetchReviewByTaskId reads the latest review for the task only', async () => {
  const review = { id: 'review-latest', task_id: 'task-2' };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve({ data: review, error: null })),
  };
  supabase.from.mockReturnValue(query);

  await expect(fetchReviewByTaskId('task-2')).resolves.toEqual(review);

  expect(supabase.from).toHaveBeenCalledWith('reviews');
  expect(query.eq).toHaveBeenCalledWith('task_id', 'task-2');
  expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  expect(query.limit).toHaveBeenCalledWith(1);
});

test('fetchWorkspaceReview uses participant-aware review lookup RPC', async () => {
  const review = { id: 'review-1', task_id: 'task-2', room_id: 'room-1' };
  supabase.rpc.mockResolvedValue({ data: review, error: null });

  await expect(
    fetchWorkspaceReview({
      roomId: 'room-1',
      taskId: 'task-2',
      clientId: 'client-1',
      specialistId: 'specialist-1',
    })
  ).resolves.toEqual(review);

  expect(supabase.rpc).toHaveBeenCalledWith('fetch_workspace_review', {
    p_room_id: 'room-1',
    p_task_id: 'task-2',
    p_client_id: 'client-1',
    p_specialist_id: 'specialist-1',
  });
});

test('fetchWorkspaceReview falls back to task review lookup when RPC is unavailable', async () => {
  const review = { id: 'review-fallback', task_id: 'task-2' };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve({ data: review, error: null })),
  };
  supabase.rpc.mockResolvedValue({
    data: null,
    error: { code: '42883', message: 'function fetch_workspace_review does not exist' },
  });
  supabase.from.mockReturnValue(query);

  await expect(fetchWorkspaceReview({ taskId: 'task-2' })).resolves.toEqual(review);

  expect(supabase.from).toHaveBeenCalledWith('reviews');
  expect(query.eq).toHaveBeenCalledWith('task_id', 'task-2');
});

test('createCompletionReceipt uses idempotent receipt RPC', async () => {
  const receipt = { id: 'receipt-1', task_id: 'task-1', receipt_type: 'service_agreement' };
  supabase.rpc.mockResolvedValue({ data: receipt, error: null });

  await expect(
    createCompletionReceipt({
      taskId: 'task-1',
      agreementId: 'agreement-1',
      receiptType: 'service_agreement',
      note: 'Created once',
    })
  ).resolves.toEqual(receipt);

  expect(supabase.rpc).toHaveBeenCalledWith('ensure_completion_receipt', {
    p_task_id: 'task-1',
    p_agreement_id: 'agreement-1',
    p_receipt_type: 'service_agreement',
    p_note: 'Created once',
  });
});

test('fetchCompletionReceipt uses durable receipt lookup RPC', async () => {
  const receipt = { id: 'receipt-1', task_id: 'task-1' };
  supabase.rpc.mockResolvedValue({ data: receipt, error: null });

  await expect(fetchCompletionReceipt('task-1')).resolves.toEqual(receipt);

  expect(supabase.rpc).toHaveBeenCalledWith('fetch_completion_receipt', {
    p_task_id: 'task-1',
    p_receipt_type: 'service_agreement',
  });
});

test('submitReview uses the review RPC contract before touching the reviews table', async () => {
  const review = { id: 'review-1', rating_score: 5, feedback_text: 'Great work' };
  supabase.rpc.mockResolvedValue({ data: review, error: null });

  await expect(
    submitReview({
      room_id: 'room-1',
      task_id: 'task-1',
      specialist_id: 'specialist-1',
      rating_score: 5,
      feedback_text: 'Great work',
    })
  ).resolves.toEqual(review);

  expect(supabase.rpc).toHaveBeenCalledWith('submit_task_review', {
    p_room_id: 'room-1',
    p_task_id: 'task-1',
    p_specialist_id: 'specialist-1',
    p_rating_score: 5,
    p_feedback_text: 'Great work',
  });
  expect(supabase.from).not.toHaveBeenCalled();
});

test('submitReview fails closed when the review RPC is unavailable', async () => {
  const payload = {
    room_id: 'room-1',
    task_id: 'task-1',
    specialist_id: 'specialist-1',
    rating_score: 4,
    feedback_text: 'Solid',
  };
  supabase.rpc.mockResolvedValue({
    data: null,
    error: { code: '42883', message: 'function submit_task_review does not exist' },
  });

  await expect(submitReview(payload)).rejects.toThrow(/required database RPC is missing/i);

  expect(supabase.from).not.toHaveBeenCalled();
});

test('sendWorkspaceMessage fails closed when the workspace RPC is unavailable', async () => {
  supabase.rpc.mockResolvedValue({
    data: null,
    error: { code: '42883', message: 'function send_workspace_message does not exist' },
  });

  await expect(sendWorkspaceMessage('room-1', 'sender-1', 'Hello', 'task-1')).rejects.toThrow(/required database RPC is missing/i);

  expect(supabase.from).not.toHaveBeenCalled();
});

test('rateClient fails closed when the client rating RPC is unavailable', async () => {
  supabase.rpc.mockResolvedValue({
    data: null,
    error: { code: '42883', message: 'function rate_client_after_completion does not exist' },
  });

  await expect(rateClient('specialist-1', 'client-1', 'task-1', 5, 'Great client')).rejects.toThrow(/required database RPC is missing/i);

  expect(supabase.from).not.toHaveBeenCalled();
});

test('fetchMarketplaceBids enriches specialists without relying on embedded schema relationships', async () => {
  const bidRows = [
    { id: 'bid-1', task_id: 'task-1', specialist_id: 'specialist-1', amount: 500, expires_at: '2026-06-08T10:00:00Z' },
  ];
  const profileRows = [
    { id: 'specialist-1', full_name: 'Mona Specialist', avatar_url: '/avatar.png', is_verified: true },
  ];

  const bidQuery = {
    select: vi.fn(() => bidQuery),
    order: vi.fn(() => bidQuery),
    limit: vi.fn(() => bidQuery),
    eq: vi.fn(() => Promise.resolve({ data: bidRows, error: null })),
  };
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    in: vi.fn(() => Promise.resolve({ data: profileRows, error: null })),
  };

  supabase.rpc.mockResolvedValue({ data: 0, error: null });
  supabase.from.mockImplementation((table) => {
    if (table === 'bids') return bidQuery;
    if (table === 'profiles') return profileQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  await expect(fetchMarketplaceBids({ userId: 'specialist-1', role: 'specialist' })).resolves.toEqual([
    {
      ...bidRows[0],
      profiles: profileRows[0],
    },
  ]);

  expect(supabase.rpc).toHaveBeenCalledWith('expire_stale_bid_requests');
  expect(bidQuery.select).toHaveBeenCalledWith('id, task_id, specialist_id, amount, note, status, created_at, expires_at, accepted_at');
  expect(profileQuery.in).toHaveBeenCalledWith('id', ['specialist-1']);
});

test('submitBid refreshes the specialist proposal response window', async () => {
  const savedBid = { id: 'bid-1', task_id: 'task-1', specialist_id: 'specialist-1', status: 'pending' };
  const query = {
    upsert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data: savedBid, error: null })),
  };
  supabase.from.mockReturnValue(query);

  await expect(submitBid({
    task_id: 'task-1',
    specialist_id: 'specialist-1',
    amount: 500,
    note: 'I can help today',
  })).resolves.toEqual(savedBid);

  expect(supabase.from).toHaveBeenCalledWith('bids');
  expect(query.upsert).toHaveBeenCalledWith([
    expect.objectContaining({
      task_id: 'task-1',
      specialist_id: 'specialist-1',
      amount: 500,
      note: 'I can help today',
      status: 'pending',
      accepted_at: null,
      expires_at: expect.any(String),
    }),
  ], { onConflict: 'task_id,specialist_id' });
});

test('expireStaleBidRequests calls the proposal-window RPC', async () => {
  supabase.rpc.mockResolvedValue({ data: 3, error: null });

  await expect(expireStaleBidRequests()).resolves.toBe(3);
  expect(supabase.rpc).toHaveBeenCalledWith('expire_stale_bid_requests');
});

test('cancelTask scopes archive updates to the owner and open tasks', async () => {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
  };
  supabase.from.mockReturnValue(query);

  await expect(cancelTask('task-1', 'client-1')).resolves.toBeUndefined();

  expect(supabase.from).toHaveBeenCalledWith('tasks');
  expect(query.update).toHaveBeenCalledWith({ status: 'archived' });
  expect(query.eq).toHaveBeenCalledWith('id', 'task-1');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'client-1');
  expect(query.eq).toHaveBeenCalledWith('status', 'open');
});
