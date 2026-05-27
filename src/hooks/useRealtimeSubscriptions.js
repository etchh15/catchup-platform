import { useEffect, useRef } from 'react';
import {
  subscribeToTasks,
  subscribeToBids,
} from '../services/supabaseService';

export function useRealtimeSubscriptions(onTasksChange, onBidsChange) {
  const unsubscribeRef = useRef([]);

  useEffect(() => {
    // Subscribe to task changes
    if (onTasksChange) {
      const unsub1 = subscribeToTasks(() => onTasksChange());
      unsubscribeRef.current.push(unsub1);
    }

    // Subscribe to bid changes
    if (onBidsChange) {
      const unsub2 = subscribeToBids(() => onBidsChange());
      unsubscribeRef.current.push(unsub2);
    }

    return () => {
      unsubscribeRef.current.forEach(unsub => unsub?.());
      unsubscribeRef.current = [];
    };
  }, [onTasksChange, onBidsChange]);
}
