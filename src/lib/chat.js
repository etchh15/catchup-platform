import { supabase } from '../supabaseClient';

export const getParticipantId = (user, role) => {
  const base = user?.participantUuid ?? user?.id ?? 'guest';
  return role === 'client' ? `client-${base}` : `specialist-${base}`;
};

export const getCounterpartyId = (role) =>
  role === 'client' ? 'specialist-1' : 'client-1';

export const mapRowToChatMessage = (row, participantId) => ({
  id: row.id,
  text: row.text,
  sender: row.sender_id === participantId ? 'me' : 'them',
  senderId: row.sender_id,
  createdAt: row.created_at,
});

export async function fetchTaskMessages(taskId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendTaskMessage({ taskId, senderId, receiverId, text }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      task_id: taskId,
      sender_id: senderId,
      receiver_id: receiverId,
      text,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToTaskMessages(taskId, onInsert) {
  const channel = supabase
    .channel(`messages-task-${taskId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `task_id=eq.${taskId}`,
      },
      (payload) => onInsert(payload.new)
    )
    .subscribe();

  return () => {
    console.log(`🔌 Scaling protection: Dissolving channel messages-task-${taskId}`);
    supabase.removeChannel(channel);
  };
}

export const subscribeToWorkspaceChat = (roomId, onMessageReceived) => {
  return supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workspace_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onMessageReceived(payload.new);
      }
    )
    .subscribe();
};
