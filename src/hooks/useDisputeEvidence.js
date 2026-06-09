import { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useDisputeEvidence(disputeId) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadEvidenceFiles = useCallback(
    async (files) => {
      if (!disputeId || !files || files.length === 0) return [];

      setUploading(true);
      setError(null);
      const uploadedEvidence = [];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          // Validate file size (max 5MB)
          if (file.size > 5 * 1024 * 1024) {
            throw new Error(`File ${file.name} is too large (max 5MB)`);
          }

          const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
          const filePath = `${disputeId}/${filename}`;

          // Upload file to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('disputes')
            .upload(filePath, file, { upsert: false });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('disputes')
            .getPublicUrl(filePath);

          uploadedEvidence.push({
            type: 'image',
            url: urlData.publicUrl,
            filename: file.name,
            uploaded_at: new Date().toISOString(),
          });

          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }

        return uploadedEvidence;
      } catch (err) {
        console.error('Error uploading evidence:', err);
        setError(err?.message || 'Failed to upload evidence');
        throw err;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [disputeId]
  );

  const deleteEvidenceFile = useCallback(
    async (filePath) => {
      setUploading(true);
      try {
        const { error: deleteError } = await supabase.storage
          .from('dispute-evidence')
          .remove([filePath]);

        if (deleteError) throw deleteError;
      } catch (err) {
        console.error('Error deleting evidence:', err);
        setError(err?.message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return {
    uploading,
    uploadProgress,
    error,
    uploadEvidenceFiles,
    deleteEvidenceFile,
  };
}
