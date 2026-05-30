import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useMilestones(agreementId, userId) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!agreementId) return;

    const fetchMilestones = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('agreement_milestones')
          .select('*')
          .eq('agreement_id', agreementId)
          .order('milestone_number', { ascending: true });

        if (fetchError) throw fetchError;
        setMilestones(data || []);
      } catch (err) {
        console.error('Error fetching milestones:', err);
        setError(err?.message || 'Failed to load milestones');
      } finally {
        setLoading(false);
      }
    };

    fetchMilestones();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`milestones:agreement_id=eq.${agreementId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agreement_milestones',
          filter: `agreement_id=eq.${agreementId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMilestones([...milestones, payload.new].sort((a, b) => a.milestone_number - b.milestone_number));
          } else if (payload.eventType === 'UPDATE') {
            setMilestones(
              milestones.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [agreementId]);

  const completeMilestone = useCallback(
    async (milestoneId, notes = '') => {
      setLoading(true);
      try {
        const { data, error: updateError } = await supabase
          .from('agreement_milestones')
          .update({
            status: 'completed',
            completed_by: userId,
            completed_at: new Date().toISOString(),
            notes,
          })
          .eq('id', milestoneId)
          .select()
          .single();

        if (updateError) throw updateError;

        setMilestones(milestones.map((m) => (m.id === milestoneId ? data : m)));
        return data;
      } catch (err) {
        console.error('Error completing milestone:', err);
        setError(err?.message || 'Failed to complete milestone');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [milestones, userId]
  );

  return { milestones, loading, error, completeMilestone };
}
