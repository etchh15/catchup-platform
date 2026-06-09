import { afterEach, expect, test, vi } from 'vitest';
import { sendTaskMessage } from './chat';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

test('sendTaskMessage refuses receiver-less messages so task chat cannot become public', async () => {
  await expect(
    sendTaskMessage({
      taskId: 'task-1',
      senderId: 'client-1',
      receiverId: null,
      text: 'Hello',
    })
  ).rejects.toThrow(/require a recipient/i);

  expect(supabase.from).not.toHaveBeenCalled();
});

test('sendTaskMessage sends only task-scoped private messages with an explicit recipient', async () => {
  const message = { id: 'message-1', task_id: 'task-1', receiver_id: 'specialist-1' };
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data: message, error: null })),
  };
  supabase.from.mockReturnValue(query);

  await expect(
    sendTaskMessage({
      taskId: 'task-1',
      senderId: 'client-1',
      receiverId: 'specialist-1',
      text: 'Can you help?',
    })
  ).resolves.toEqual(message);

  expect(supabase.from).toHaveBeenCalledWith('messages');
  expect(query.insert).toHaveBeenCalledWith({
    task_id: 'task-1',
    sender_id: 'client-1',
    receiver_id: 'specialist-1',
    text: 'Can you help?',
  });
});
