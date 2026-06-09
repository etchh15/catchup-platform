import { useState, useEffect, useCallback } from 'react';
import {
  fetchUserProfile,
  createUserProfile,
  currentUserIsPlatformAdmin,
  updateUserRole,
} from '../services/supabaseService';

export function useProfile(user) {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setRole(null);
      return null;
    }

    const [data, isAdmin] = await Promise.all([
      fetchUserProfile(user.id),
      currentUserIsPlatformAdmin(),
    ]);
    setProfile(data);
    setRole(isAdmin ? 'admin' : data?.role ?? null);
    return data;
  }, [user]);

  // Fetch or create profile
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setRole(null);
      return;
    }

    setLoading(true);
    refreshProfile()
      .catch(() => {
        setProfile(null);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, [user, refreshProfile]);

  const setupRole = async (chosenRole) => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await createUserProfile(
        user.id,
        chosenRole,
        user.email,
        user.email?.split('@')[0] || 'User'
      );
      setProfile(data);
      setRole(data.role);
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (newRole) => {
    if (!user) return;
    if (!['client', 'specialist'].includes(newRole)) return;

    setLoading(true);
    try {
      await updateUserRole(user.id, newRole);
      setRole(newRole);
      setProfile(prev => prev ? { ...prev, role: newRole } : null);
    } finally {
      setLoading(false);
    }
  };

  return { profile, role, loading, setupRole, switchRole, refreshProfile };
}
