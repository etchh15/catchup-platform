import { useState, useCallback, useEffect } from 'react';
import { fetchOpenDisputesForAdmin, resolveDispute } from '../services/supabaseService';

export function useAdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchOpenDisputesForAdmin();
      setDisputes(data);
    } catch (err) {
      console.error('Error loading admin disputes:', err);
      setError(err?.message || 'Failed to load dispute queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const resolve = useCallback(
    async (disputeId, resolution, amount) => {
      setLoading(true);
      setError(null);

      try {
        await resolveDispute(disputeId, resolution, null, amount);
        await loadDisputes();
      } catch (err) {
        console.error('Error resolving dispute:', err);
        setError(err?.message || 'Failed to resolve dispute');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadDisputes]
  );

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  return {
    disputes,
    loading,
    error,
    refresh: loadDisputes,
    resolve,
  };
}
