import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useAgreement(taskId, userId) {
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId || !userId) return;

    const fetchAgreement = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('agreements')
          .select('*')
          .eq('task_id', taskId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        setAgreement(data || null);
      } catch (err) {
        console.error('Error fetching agreement:', err);
        setError(err?.message || 'Failed to load agreement');
      } finally {
        setLoading(false);
      }
    };

    fetchAgreement();

    // Subscribe to real-time updates
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
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setAgreement(payload.new);
          } else if (payload.eventType === 'DELETE') {
            setAgreement(null);
          }
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [taskId, userId]);

  const updateAgreement = useCallback(
    async (updates) => {
      if (!agreement) return;
      setLoading(true);
      try {
        const { data, error: updateError } = await supabase
          .from('agreements')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', agreement.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setAgreement(data);
        return data;
      } catch (err) {
        console.error('Error updating agreement:', err);
        setError(err?.message || 'Failed to update agreement');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [agreement]
  );

  return { agreement, loading, error, updateAgreement };
}
