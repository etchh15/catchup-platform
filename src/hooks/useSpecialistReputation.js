import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useSpecialistReputation(specialistId) {
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch reputation data
  const fetchReputation = useCallback(async () => {
    if (!specialistId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('specialist_reputation')
        .select('*')
        .eq('specialist_id', specialistId)
        .maybeSingle();

      if (fetchError) {
        console.warn('Reputation not found, using defaults:', fetchError);
        // Return default reputation for new specialists
        setReputation({
          specialist_id: specialistId,
          total_completed_jobs: 0,
          total_reviews: 0,
          average_rating: 0,
          response_time_hours: 0,
          is_verified: false,
          service_categories: [],
          service_areas: [],
          profile_completeness: 0,
        });
      } else {
        setReputation(data);
      }
    } catch (err) {
      console.error('Error fetching reputation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [specialistId]);

  // Subscribe to real-time reputation updates
  useEffect(() => {
    if (!specialistId) return;

    fetchReputation();

    // Subscribe to reputation updates
    const subscription = supabase
      .channel(`specialist_reputation:specialist_id=eq.${specialistId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'specialist_reputation',
          filter: `specialist_id=eq.${specialistId}`,
        },
        (payload) => {
          setReputation(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [specialistId, fetchReputation]);

  return {
    reputation,
    loading,
    error,
    fetchReputation,
  };
}

// Hook to fetch multiple specialists' reputations
export function useSpecialistReputations(specialistIds = []) {
  const [reputations, setReputations] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!specialistIds || specialistIds.length === 0) return;

    setLoading(true);

    const fetchReputations = async () => {
      try {
        const { data, error } = await supabase
          .from('specialist_reputation')
          .select('*')
          .in('specialist_id', specialistIds);

        if (error) throw error;

        // Convert to object keyed by specialist_id
        const reputationMap = {};
        (data || []).forEach(rep => {
          reputationMap[rep.specialist_id] = rep;
        });

        setReputations(reputationMap);
      } catch (err) {
        console.error('Error fetching reputations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReputations();
  }, [specialistIds]);

  return {
    reputations,
    loading,
  };
}

// Hook to fetch client reputation
export function useClientReputation(clientId) {
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    setLoading(true);

    const fetchClientRep = async () => {
      try {
        const { data, error } = await supabase
          .from('client_reputation')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();

        if (error) {
          console.warn('Client reputation not found');
          // Default for new clients
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
      } finally {
        setLoading(false);
      }
    };

    fetchClientRep();
  }, [clientId]);

  return {
    reputation,
    loading,
  };
}
