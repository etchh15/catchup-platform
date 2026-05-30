import { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useDispute(taskId, userId) {
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
          .from('disputes')
          .insert([
            {
              task_id: taskId,
              filed_by: userId,
              reason,
              reason_category: reasonCategory,
              status: 'open',
            },
          ])
          .select()
          .single();

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
    [taskId, userId]
  );

  const respondToDispute = useCallback(
    async (message, evidence = null) => {
      if (!dispute) return;

      setLoading(true);
      try {
        const { data, error: respondError } = await supabase
          .from('dispute_responses')
          .insert([
            {
              dispute_id: dispute.id,
              responder_id: userId,
              message,
              evidence,
            },
          ])
          .select()
          .single();

        if (respondError) throw respondError;

        setResponses([...responses, data]);
        return data;
      } catch (err) {
        console.error('Error responding to dispute:', err);
        setError(err?.message || 'Failed to respond to dispute');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [dispute, userId, responses]
  );

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
