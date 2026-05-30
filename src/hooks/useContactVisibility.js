import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useContactVisibility(userId, otherUserId, roomId) {
  const [isContactRevealed, setIsContactRevealed] = useState(false);
  const [revealedAt, setRevealedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check if contact has been revealed
  useEffect(() => {
    if (!userId || !otherUserId || !roomId) return;

    const checkContactReveal = async () => {
      try {
        const { data, error } = await supabase
          .from('workspace_rooms')
          .select('contact_revealed_at')
          .eq('id', roomId)
          .maybeSingle();

        if (error) {
          console.error('Error checking contact reveal:', error);
        } else {
          setIsContactRevealed(!!data?.contact_revealed_at);
          setRevealedAt(data?.contact_revealed_at);
        }
      } catch (err) {
        console.error('Error in contact visibility check:', err);
      }
    };

    checkContactReveal();

    // Subscribe to changes
    const subscription = supabase
      .channel(`workspace_rooms:id=eq.${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          setIsContactRevealed(!!payload.new.contact_revealed_at);
          setRevealedAt(payload.new.contact_revealed_at);
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [userId, otherUserId, roomId]);

  // Reveal contact details and log access
  const revealContact = useCallback(async () => {
    if (!userId || !otherUserId || !roomId) return;

    setLoading(true);

    try {
      // Update workspace_rooms to mark contact revealed
      const { error: updateError } = await supabase
        .from('workspace_rooms')
        .update({ contact_revealed_at: new Date().toISOString() })
        .eq('id', roomId)
        .is('contact_revealed_at', null); // Only if not already revealed

      if (updateError) throw updateError;

      // Log access to contact_access_log
      const { error: logError } = await supabase
        .from('contact_access_log')
        .insert([
          {
            viewer_id: userId,
            target_id: otherUserId,
            room_id: roomId,
          },
        ]);

      if (logError) {
        console.warn('Could not log contact access:', logError);
        // Don't fail the reveal if logging fails
      }

      setIsContactRevealed(true);
      setRevealedAt(new Date().toISOString());
    } catch (err) {
      console.error('Error revealing contact:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, otherUserId, roomId]);

  return {
    isContactRevealed,
    revealedAt,
    loading,
    revealContact,
  };
}

// Hook to get contact info safely based on workspace acceptance
export function useWorkspaceContact(userId, otherUserId, workspaceStatus = 'pending') {
  const [contactInfo, setContactInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!otherUserId) return;

    // Only show contact if workspace is accepted
    if (workspaceStatus !== 'accepted') {
      setContactInfo(null);
      return;
    }

    setLoading(true);

    const fetchContact = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone, email, whatsapp, avatar_url')
          .eq('id', otherUserId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching contact info:', error);
        } else {
          setContactInfo(data);
        }
      } catch (err) {
        console.error('Error in useWorkspaceContact:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [otherUserId, workspaceStatus]);

  return {
    contactInfo,
    loading,
  };
}
