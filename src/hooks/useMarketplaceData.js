import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchAllActiveTasks,
  fetchMarketplaceBids,
  fetchSpecialists,
} from '../services/supabaseService';

export function useMarketplaceData(districtFilter = 'all', user = null, role = null) {
  const [tasks, setTasks] = useState([]);
  const [bids, setBids] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const syncData = useCallback(async () => {
    if (!user?.id || !role) {
      setTasks([]);
      setBids([]);
      setSpecialists([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [tasksData, bidsData, specialistsData] = await Promise.all([
        fetchAllActiveTasks(),
        fetchMarketplaceBids({ userId: user?.id, role }),
        fetchSpecialists({ districtFilter }),
      ]);
      setTasks(tasksData);
      setBids(bidsData);
      setSpecialists(specialistsData);
    } catch (err) {
      const message = err?.message || 'Marketplace data could not be loaded.';
      setError(message);
      console.error('Marketplace sync error:', message);
    } finally {
      setLoading(false);
    }
  }, [districtFilter, user?.id, role]);

  useEffect(() => {
    syncData();
  }, [syncData]);

  // Derived: unread bids
  const unreadBids = useMemo(() => {
    return bids.filter(b => b.status === 'pending').length;
  }, [bids]);

  return {
    tasks,
    bids,
    specialists,
    loading,
    error,
    syncData,
    unreadBids,
  };
}
