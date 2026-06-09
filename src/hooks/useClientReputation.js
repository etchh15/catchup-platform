import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useClientReputation(clientId) {
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId) return;

    const fetchReputation = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('client_reputation')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        // If no reputation record, create default
        if (!data) {
          setReputation({
            client_id: clientId,
            total_jobs_posted: 0,
            total_jobs_completed: 0,
            completion_rate: 0,
            average_acceptance_rate: 0,
            phone_verified: false,
            email_verified: false,
            average_rating_from_specialists: 0,
            total_ratings_given: 0,
            average_response_time_hours: 0,
          });
        } else {
          setReputation(data);
        }
      } catch (err) {
        console.error('Error fetching client reputation:', err);
        setError(err?.message || 'Failed to load client reputation');
      } finally {
        setLoading(false);
      }
    };

    fetchReputation();

    // Subscribe to real-time updates
    const channelName = `client_reputation:client_id=eq.${clientId}:${Math.random().toString(36).slice(2)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_reputation',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setReputation(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [clientId]);

  return { reputation, loading, error };
}
