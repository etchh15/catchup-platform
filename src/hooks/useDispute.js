import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useDispute(taskId) {
  const [dispute, setDispute] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDispute = useCallback(async () => {
    setLoading(true);
    try {
      const { data: disputeData } = await supabase
        .from('disputes')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setDispute(disputeData || null);

      if (disputeData) {
        const { data: responsesData } = await supabase
          .from('dispute_responses')
          .select('*')
          .eq('dispute_id', disputeData.id)
          .order('created_at', { ascending: true });

        setResponses(responsesData || []);
      }
    } catch (err) {
      console.error('Error fetching dispute:', err);
      setError(err?.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const fileDispute = useCallback(
    async (reason, reasonCategory) => {
      setLoading(true);
      try {
        const { data, error: fileError } = await supabase
          .rpc('file_task_dispute', {
            p_task_id: taskId,
            p_reason: reason,
            p_reason_category: reasonCategory,
            p_referenced_message_id: null,
          });

        if (fileError) throw fileError;

        setDispute(data);
        return data;
      } catch (err) {
        console.error('Error filing dispute:', err);
        setError(err?.message || 'Failed to file dispute');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [taskId]
  );

  const respondToDispute = useCallback(
    async (message, evidence = null) => {
      if (!dispute) return;

      setLoading(true);
      try {
        const { data, error: respondError } = await supabase
          .rpc('respond_to_task_dispute', {
            p_dispute_id: dispute.id,
            p_message: message,
            p_evidence: evidence,
          });

        if (respondError) throw respondError;

        setResponses((prevResponses) => [...prevResponses, data]);
        return data;
      } catch (err) {
        console.error('Error responding to dispute:', err);
        setError(err?.message || 'Failed to respond to dispute');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [dispute]
  );

  useEffect(() => {
    if (!dispute?.id) return;

    const channel = supabase
      .channel(`dispute-responses:${dispute.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_responses',
          filter: `dispute_id=eq.${dispute.id}`,
        },
        (payload) => {
          const newResponse = payload.new;
          setResponses((prev) => {
            if (prev.some((item) => item.id === newResponse.id)) return prev;
            return [...prev, newResponse];
          });
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [dispute?.id]);

  return { dispute, responses, loading, error, fetchDispute, fileDispute, respondToDispute };
}

export function useDisputeEvidence() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const uploadEvidence = useCallback(async (disputeId, files) => {
    setUploading(true);
    setError(null);

    try {
      const uploadedEvidence = [];

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large (max 5MB)`);
        }

        const fileName = `${disputeId}/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('disputes')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('disputes').getPublicUrl(fileName);

        uploadedEvidence.push({
          type: 'image',
          url: data.publicUrl,
          uploaded_at: new Date().toISOString(),
          filename: file.name,
        });
      }

      return uploadedEvidence;
    } catch (err) {
      console.error('Error uploading evidence:', err);
      setError(err?.message || 'Failed to upload evidence');
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploadEvidence, uploading, error };
}
