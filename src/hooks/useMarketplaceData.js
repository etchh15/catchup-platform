import { useState, useEffect, useMemo } from 'react';
import {
  fetchAllActiveTasks,
  fetchAllBids,
  fetchSpecialists,
} from '../services/supabaseService';

export function useMarketplaceData(districtFilter = 'all') {
  const [tasks, setTasks] = useState([]);
  const [bids, setBids] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(false);

  const syncData = async () => {
    setLoading(true);
    try {
      const [tasksData, bidsData, specialistsData] = await Promise.all([
        fetchAllActiveTasks(),
        fetchAllBids(),
        fetchSpecialists({ districtFilter }),
      ]);
      setTasks(tasksData);
      setBids(bidsData);
      setSpecialists(specialistsData);
    } catch (err) {
      console.error('Sync error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncData();
  }, [districtFilter]);

  // Derived: unread bids
  const unreadBids = useMemo(() => {
    return bids.filter(b => b.status === 'pending').length;
  }, [bids]);

  return {
    tasks,
    bids,
    specialists,
    loading,
    syncData,
    unreadBids,
  };
}
