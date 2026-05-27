import { useState, useEffect } from 'react';
import {
  fetchUserProfile,
  createUserProfile,
  updateUserRole,
} from '../services/supabaseService';

export function useProfile(user) {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch or create profile
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setRole(null);
      return;
    }

    setLoading(true);
    fetchUserProfile(user.id)
      .then((data) => {
        setProfile(data);
        setRole(data?.role ?? null);
      })
      .catch(() => {
        setProfile(null);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, [user]);

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

    setLoading(true);
    try {
      await updateUserRole(user.id, newRole);
      setRole(newRole);
      setProfile(prev => prev ? { ...prev, role: newRole } : null);
    } finally {
      setLoading(false);
    }
  };

  return { profile, role, loading, setupRole, switchRole };
}
