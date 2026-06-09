import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  fetchAppointmentByTask,
  proposeAppointment as proposeAppointmentService,
  confirmAppointment as confirmAppointmentService,
  counterProposeAppointment as counterProposeAppointmentService,
} from '../services/supabaseService';

const normalizeAppointment = (appointment) => {
  if (!appointment) return appointment;
  return {
    ...appointment,
    status: String(appointment.status || '').toLowerCase(),
    proposed_date: appointment.proposed_date || appointment.starts_at,
  };
};

export function useAppointmentScheduling(taskId, agreementId, userId) {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) return;

    const fetchAppointment = async () => {
      setLoading(true);
      try {
        const data = await fetchAppointmentByTask(taskId);
        setAppointment(data || null);
      } catch (err) {
        console.error('Error fetching appointment:', err);
        setError(err?.message || 'Failed to load appointment');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();

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
            setAppointment(normalizeAppointment(payload.new));
          }
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [taskId]);

  const proposeAppointment = useCallback(
    async (proposedDate, address, notes = '', options = {}) => {
      setLoading(true);
      try {
        const data = await proposeAppointmentService(taskId, agreementId, proposedDate, 'specialist', address, notes, options);
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
        const data = await confirmAppointmentService(appointmentId, 'client');
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
    async (appointmentId, newDate, proposedBy = 'client', address = null, notes = null, options = {}) => {
      setLoading(true);
      try {
        const data = await counterProposeAppointmentService(appointmentId, newDate, proposedBy, address, notes, options);
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
