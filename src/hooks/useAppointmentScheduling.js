import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useAppointmentScheduling(taskId, agreementId, userId) {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) return;

    const fetchAppointment = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('appointments')
          .select('*')
          .eq('task_id', taskId)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        setAppointment(data || null);
      } catch (err) {
        console.error('Error fetching appointment:', err);
        setError(err?.message || 'Failed to load appointment');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`appointments:task_id=eq.${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setAppointment(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [taskId]);

  const proposeAppointment = useCallback(
    async (proposedDate, address, notes = '') => {
      setLoading(true);
      try {
        const { data, error: insertError } = await supabase
          .from('appointments')
          .insert([
            {
              task_id: taskId,
              agreement_id: agreementId,
              proposed_date: proposedDate,
              proposed_by: 'specialist',
              service_address: address,
              notes,
              status: 'pending',
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        setAppointment(data);
        return data;
      } catch (err) {
        console.error('Error proposing appointment:', err);
        setError(err?.message || 'Failed to propose appointment');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [taskId, agreementId]
  );

  const confirmAppointment = useCallback(
    async (appointmentId) => {
      if (!appointmentId) return;

      setLoading(true);
      try {
        const { data, error: updateError } = await supabase
          .from('appointments')
          .update({
            status: 'confirmed',
            confirmed_by: 'client',
            confirmed_date: new Date().toISOString(),
          })
          .eq('id', appointmentId)
          .select()
          .single();

        if (updateError) throw updateError;
        setAppointment(data);
        return data;
      } catch (err) {
        console.error('Error confirming appointment:', err);
        setError(err?.message || 'Failed to confirm appointment');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const counterPropose = useCallback(
    async (appointmentId, newDate) => {
      setLoading(true);
      try {
        const { data, error: updateError } = await supabase
          .from('appointments')
          .update({
            proposed_date: newDate,
            status: 'rescheduled',
          })
          .eq('id', appointmentId)
          .select()
          .single();

        if (updateError) throw updateError;
        setAppointment(data);
        return data;
      } catch (err) {
        console.error('Error counter-proposing:', err);
        setError(err?.message || 'Failed to counter-propose');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    appointment,
    loading,
    error,
    proposeAppointment,
    confirmAppointment,
    counterPropose,
  };
}
