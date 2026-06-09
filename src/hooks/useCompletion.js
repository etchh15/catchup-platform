import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { markWorkDelivered, confirmWorkCompleted } from '../services/supabaseService';

export function useCompletion(taskId, userId) {
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId || !userId) return;

    const fetchCompletion = async () => {
      setLoading(true);
      try {
        const { data: task } = await supabase
          .from('tasks')
          .select('work_delivered_by, work_delivered_at, confirmed_by_client, confirmed_by_client_at, status')
          .eq('id', taskId)
          .single();

        if (task) {
          setCompletion({
            taskId,
            workDeliveredBy: task.work_delivered_by,
            workDeliveredAt: task.work_delivered_at,
            confirmedByClient: task.confirmed_by_client,
            confirmedByClientAt: task.confirmed_by_client_at,
            status: task.status,
          });
        }
      } catch (err) {
        console.error('Error fetching completion:', err);
        setError(err?.message || 'Failed to load completion status');
      } finally {
        setLoading(false);
      }
    };

    fetchCompletion();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`tasks:id=eq.${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          const task = payload.new;
          setCompletion({
            taskId: task.id,
            workDeliveredBy: task.work_delivered_by,
            workDeliveredAt: task.work_delivered_at,
            confirmedByClient: task.confirmed_by_client,
            confirmedByClientAt: task.confirmed_by_client_at,
            status: task.status,
          });
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [taskId, userId]);

  const markDelivered = useCallback(
    async (message = '') => {
      setLoading(true);
      try {
        const task = await markWorkDelivered(taskId, userId, message);
        const deliveredAt = task?.work_delivered_at || new Date().toISOString();
        setCompletion((prev) => ({
          ...(prev || { taskId }),
          taskId,
          workDeliveredBy: task?.work_delivered_by || userId,
          workDeliveredAt: deliveredAt,
          confirmedByClient: task?.confirmed_by_client || prev?.confirmedByClient || null,
          confirmedByClientAt: task?.confirmed_by_client_at || prev?.confirmedByClientAt || null,
          status: task?.status || prev?.status || 'active',
        }));
        return true;
      } catch (err) {
        console.error('Error marking delivery:', err);
        setError(err?.message || 'Failed to mark work as delivered');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [taskId, userId]
  );

  const confirmCompleted = useCallback(
    async (message = '') => {
      setLoading(true);
      try {
        const task = await confirmWorkCompleted(taskId, userId, message);
        const confirmedAt = task?.confirmed_by_client_at || new Date().toISOString();
        setCompletion((prev) => ({
          ...(prev || { taskId }),
          taskId,
          workDeliveredBy: task?.work_delivered_by || prev?.workDeliveredBy || null,
          workDeliveredAt: task?.work_delivered_at || prev?.workDeliveredAt || null,
          confirmedByClient: task?.confirmed_by_client || userId,
          confirmedByClientAt: confirmedAt,
          status: task?.status || 'completed',
        }));
        return true;
      } catch (err) {
        console.error('Error confirming completion:', err);
        setError(err?.message || 'Failed to confirm work completion');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [taskId, userId]
  );

  return { completion, loading, error, markDelivered, confirmCompleted };
}
