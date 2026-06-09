import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useContactVisibility(userId, otherUserId, roomId, workspaceStatus = 'pending') {
  const [isContactRevealed, setIsContactRevealed] = useState(false);
  const [revealedAt, setRevealedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const canRevealContact = workspaceStatus === 'active';

  // Check if contact has been revealed
  useEffect(() => {
    if (!userId || !otherUserId || !roomId || !canRevealContact) {
      setIsContactRevealed(false);
      setRevealedAt(null);
      setLoading(false);
      return;
    }

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
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [userId, otherUserId, roomId, canRevealContact]);

  // Reveal contact details and log access
  const revealContact = useCallback(async () => {
    if (!userId || !otherUserId || !roomId || !canRevealContact) return;

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
  }, [userId, otherUserId, roomId, canRevealContact]);

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

// Only active workspaces may expose contact information. Completed deals return
// to protected mode so participants cannot keep sharing direct details here.
  const acceptedStatuses = ['active'];
  if (!acceptedStatuses.includes(workspaceStatus)) {
      setContactInfo(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchContact = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, email_address, avatar_url, portfolio_images')
          .eq('id', otherUserId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching contact info:', error);
        } else if (data) {
          setContactInfo({
            ...data,
            phone: data.phone_number ?? null,
            whatsapp: data.phone_number ?? null,
            email: data.email_address ?? null,
            avatar_url: data.avatar_url || (Array.isArray(data.portfolio_images) ? data.portfolio_images[0] : null),
          });
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
