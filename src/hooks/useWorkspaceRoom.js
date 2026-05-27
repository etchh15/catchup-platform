import { useState, useEffect } from 'react';
import {
  fetchWorkspaceRoomsForUser,
  fetchWorkspaceMessages,
  subscribeToWorkspaceMessages,
} from '../services/supabaseService';

export function useWorkspaceRooms(user) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRooms([]);
      setLoading(false);
      return;
    }

    fetchWorkspaceRoomsForUser(user.id)
      .then(setRooms)
      .catch((err) => {
        console.error('Workspace load error:', err.message);
        setRooms([]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return { rooms, loading, setRooms };
}

export function useWorkspaceChat(roomId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadMessages = async () => {
      try {
        const data = await fetchWorkspaceMessages(roomId);
        if (isMounted) setMessages(data);
      } catch (err) {
        console.error('Message load error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const unsubscribe = subscribeToWorkspaceMessages(roomId, (newMessage) => {
      if (isMounted) {
        setMessages((prev) => [...prev, newMessage]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [roomId]);

  return { messages, loading, setMessages };
}
