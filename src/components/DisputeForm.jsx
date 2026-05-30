import React, { useState, useRef } from 'react';
import { useDisputeEvidence } from '../hooks/useDispute';

export default function DisputeForm({ taskId, onDisputeFiled, onCancel, loading }) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('quality');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const { uploadEvidence, uploading } = useDisputeEvidence();

  const CATEGORIES = ['quality', 'no_show', 'incomplete', 'other'];

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 5) {
      alert('Maximum 5 files allowed');
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason.trim()) {
      alert('Please enter a dispute reason');
      return;
    }

    try {
      // File dispute will be created in parent component
      // Here we just pass the data
      let uploadedEvidence = null;

      if (selectedFiles.length > 0) {
        uploadedEvidence = await uploadEvidence(taskId, selectedFiles);
      }

      await onDisputeFiled({
        reason,
        category,
        evidence: uploadedEvidence,
      });

      // Reset form
      setReason('');
      setCategory('quality');
      setSelectedFiles([]);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>File a Dispute</h3>

      <div style={styles.field}>
        <label style={styles.label}>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={styles.input}
          disabled={loading || uploading}
        >
          <option value="quality">Quality not as agreed</option>
          <option value="no_show">Specialist didn't show up</option>
          <option value="incomplete">Work incomplete</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Reason *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe what went wrong..."
          maxLength={1000}
          style={styles.textarea}
          disabled={loading || uploading}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>
          Evidence (up to 5 images, max 5MB each)
        </label>
        <div style={styles.fileInput}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={styles.uploadBtn}
            disabled={uploading}
          >
            📎 Upload Images
          </button>
        </div>

        {selectedFiles.length > 0 && (
          <div style={styles.fileList}>
            {selectedFiles.map((file, i) => (
              <div key={i} style={styles.fileItem}>
                <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={styles.removeBtn}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {uploading && (
        <div style={styles.progress}>
          Uploading evidence... {uploadProgress}%
        </div>
      )}

      <div style={styles.buttons}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading || uploading}
          style={styles.cancelBtn}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || uploading || !reason.trim()}
          style={styles.submitBtn}
        >
          {loading ? 'Filing...' : 'File Dispute'}
        </button>
      </div>
    </form>
  );
}

const styles = {
  form: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '600',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#666',
  },
  input: {
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  textarea: {
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '100px',
  },
  fileInput: {
    display: 'flex',
    gap: '8px',
  },
  uploadBtn: {
    flex: 1,
    padding: '10px',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fileItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    background: '#f9fafb',
    borderRadius: '4px',
    fontSize: '13px',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  progress: {
    fontSize: '13px',
    color: '#666',
    padding: '8px',
    background: '#f3f4f6',
    borderRadius: '4px',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    background: 'white',
    color: '#666',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1,
    padding: '10px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
