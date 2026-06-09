import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ProjectRoom from './ProjectRoom';
import {
  sendWorkspaceMessage,
  fetchWorkspaceRoomsForUser,
  fetchWorkspaceChatMessages,
  resolveWorkspaceChatRoomId,
  fetchSpecialistRatings,
  fetchWorkspaceReview,
  fetchCompletionReceipt,
  createCompletionReceipt,
} from '../services/supabaseService';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('../lib/chat', () => ({
  subscribeToWorkspaceChat: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

vi.mock('../services/supabaseService', () => ({
  fetchWorkspaceRoomsForUser: vi.fn(),
  fetchWorkspaceChatMessages: vi.fn(() => Promise.resolve([])),
  resolveWorkspaceChatRoomId: vi.fn(() => Promise.resolve('11111111-1111-4111-8111-111111111111')),
  fetchTaskById: vi.fn(() => Promise.resolve(null)),
  fetchReviewByTaskId: vi.fn(() => Promise.resolve(null)),
  fetchWorkspaceReview: vi.fn(() => Promise.resolve(null)),
  sendWorkspaceMessage: vi.fn(),
  submitReview: vi.fn(),
  uploadDisputeEvidence: vi.fn(),
  updateWorkspaceRoomStatus: vi.fn(),
  createCompletionReceipt: vi.fn(),
  fetchCompletionReceipt: vi.fn(() => Promise.resolve(null)),
  fetchSpecialistRatings: vi.fn(() => Promise.resolve([])),
  rateClient: vi.fn(),
}));

vi.mock('../hooks/useContactVisibility', () => ({
  useContactVisibility: () => ({
    isContactRevealed: false,
    revealedAt: null,
    loading: false,
    revealContact: vi.fn(),
  }),
  useWorkspaceContact: () => ({ contactInfo: null, loading: false }),
}));

vi.mock('../hooks/useAgreement', () => ({
  useAgreement: () => ({ agreement: null, loading: false, updateAgreement: vi.fn() }),
}));

vi.mock('../hooks/useCompletion', () => ({
  useCompletion: () => ({
    completion: {},
    loading: false,
    markDelivered: vi.fn(),
    confirmCompleted: vi.fn(),
  }),
}));

vi.mock('../hooks/useMilestones', () => ({
  useMilestones: () => ({ milestones: [], loading: false, completeMilestone: vi.fn() }),
}));

vi.mock('../hooks/useAppointmentScheduling', () => ({
  useAppointmentScheduling: () => ({
    appointment: null,
    loading: false,
    error: null,
    proposeAppointment: vi.fn(),
    confirmAppointment: vi.fn(),
    counterPropose: vi.fn(),
  }),
}));

vi.mock('../hooks/useReceiptGeneration', () => ({
  useReceiptGeneration: () => ({ generateAndDownloadPDF: vi.fn() }),
}));

vi.mock('../hooks/useDispute', () => ({
  useDispute: () => ({
    dispute: null,
    responses: [],
    loading: false,
    fetchDispute: vi.fn(),
    fileDispute: vi.fn(),
    respondToDispute: vi.fn(),
  }),
}));

vi.mock('./ContactCard', () => ({ default: () => null }));
vi.mock('./AgreementCard', () => ({ default: () => null }));
vi.mock('./DeliveryButton', () => ({ default: () => null }));
vi.mock('./CompletionConfirmationModal', () => ({ default: () => null }));
vi.mock('./MilestoneChecklist', () => ({ default: () => null }));
vi.mock('./DisputeForm', () => ({ default: () => null }));
vi.mock('./DisputeThread', () => ({ default: () => null }));
vi.mock('./ReceiptPDF', () => ({ default: () => null }));
vi.mock('./ScheduleAppointment', () => ({ default: () => null }));

const user = { id: 'client-1' };
const directRoom = {
  id: '22222222-2222-4222-8222-222222222222',
  task_id: 'task-direct',
  client_id: 'client-1',
  specialist_id: 'specialist-1',
  status: 'active',
  tasks: { title: 'Direct workspace', budget: 100 },
};
const firstRoom = {
  id: '33333333-3333-4333-8333-333333333333',
  task_id: 'task-first',
  client_id: 'client-1',
  specialist_id: 'specialist-2',
  status: 'active',
  tasks: { title: 'First workspace', budget: 50 },
};
const completedRoom = {
  id: '44444444-4444-4444-8444-444444444444',
  task_id: 'task-completed',
  client_id: 'client-1',
  specialist_id: 'specialist-1',
  status: 'completed',
  tasks: { title: 'Completed workspace', budget: 75 },
};

beforeEach(() => {
  const query = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
  supabase.from.mockReturnValue(query);
  fetchWorkspaceRoomsForUser.mockResolvedValue([firstRoom, directRoom]);
  fetchWorkspaceChatMessages.mockResolvedValue([]);
  resolveWorkspaceChatRoomId.mockResolvedValue('11111111-1111-4111-8111-111111111111');
  fetchCompletionReceipt.mockResolvedValue(null);
  createCompletionReceipt.mockResolvedValue({ id: 'receipt-auto', task_id: 'task-completed', receipt_type: 'service_agreement' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('preserves activeRoomProp after loading the room list', async () => {
  render(<ProjectRoom user={user} activeRoom={directRoom} />);

  expect(await screen.findByRole('heading', { name: /Direct workspace/i })).toBeInTheDocument();
  expect(screen.getByText(/Secure channel 11111111/i)).toBeInTheDocument();
});

test('restores the chat input when message send fails', async () => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sendWorkspaceMessage.mockRejectedValue(new Error('network down'));

  render(<ProjectRoom user={user} activeRoom={directRoom} />);

  const input = await screen.findByPlaceholderText(/Write a clear update/i);
  fireEvent.change(input, { target: { value: 'Please check this' } });
  fireEvent.click(screen.getByRole('button', { name: /send/i }));

  await waitFor(() => {
    expect(input).toHaveValue('Please check this');
  });

  expect(sendWorkspaceMessage).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'client-1', 'Please check this', 'task-direct');
  window.alert.mockRestore();
  console.error.mockRestore();
});

test('locks chat and contact sharing after workspace completion', async () => {
  render(<ProjectRoom user={user} activeRoom={completedRoom} />);

  expect(await screen.findByRole('heading', { name: /Completed workspace/i })).toBeInTheDocument();
  expect(screen.getByText(/Conversation closed/i)).toBeInTheDocument();
  expect(screen.getByText(/Completed tasks cannot send messages/i)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/Write a clear update/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^send$/i })).not.toBeInTheDocument();
});

test('shows sealed client review state for specialists after rating a completed task', async () => {
  fetchSpecialistRatings.mockResolvedValue([
    {
      id: 'client-rating-1',
      task_id: 'task-completed',
      specialist_id: 'specialist-1',
      client_id: 'client-1',
      rating: 5,
    },
  ]);

  render(<ProjectRoom user={{ id: 'specialist-1' }} activeRoom={completedRoom} />);

  expect(await screen.findByText(/Client reviewed/i)).toBeInTheDocument();
  expect(screen.getByText(/Reputation sealed/i)).toBeInTheDocument();
  expect(screen.getByText(/Client reviewed/i).closest('button')).toBeDisabled();
  expect(screen.queryByText(/Update review/i)).not.toBeInTheDocument();
});

test('does not ask client to leave review again when workspace review already exists', async () => {
  fetchWorkspaceReview.mockResolvedValue({
    id: 'review-1',
    task_id: 'task-completed',
    room_id: completedRoom.id,
    client_id: 'client-1',
    specialist_id: 'specialist-1',
    rating_score: 5,
  });

  render(<ProjectRoom user={user} activeRoom={completedRoom} />);

  expect(await screen.findByRole('heading', { name: /Completed workspace/i })).toBeInTheDocument();
  expect(await screen.findByText(/Work is done/i)).toBeInTheDocument();
  expect(screen.getByText(/Review sealed and reputation updated/i)).toBeInTheDocument();
  expect(screen.getByText(/Receipt ready/i)).toBeInTheDocument();
  expect(screen.queryByText(/Leave review/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Keep the workspace updated/i)).not.toBeInTheDocument();
  expect(screen.getByText(/Specialist reviewed/i)).toBeInTheDocument();
  expect(screen.getByText(/Specialist reviewed/i).closest('button')).toBeDisabled();
  expect(fetchWorkspaceReview).toHaveBeenCalledWith({
    roomId: completedRoom.id,
    taskId: completedRoom.task_id,
    clientId: completedRoom.client_id,
    specialistId: completedRoom.specialist_id,
  });
});
