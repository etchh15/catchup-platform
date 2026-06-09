import React, { useState, useRef } from 'react';
import { useToast } from './Toast';

export default function DisputeForm({ taskId, onDisputeFiled, onCancel, loading }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('quality');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);
  const uploading = loading;

  const CATEGORIES = [
    { value: 'quality', label: 'Quality not as agreed' },
    { value: 'no_show', label: "Specialist didn't show up" },
    { value: 'incomplete', label: 'Work incomplete' },
    { value: 'other', label: 'Other' },
  ];

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 5) {
      setFileError('Maximum 5 files allowed');
      return;
    }

    const oversized = files.find((file) => file.size > 5 * 1024 * 1024);
    if (oversized) {
      setFileError(`File ${oversized.name} is too large (max 5MB)`);
      return;
    }

    setFileError(null);
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast('Please enter a dispute reason', 'warning');
      return;
    }

    try {
      await onDisputeFiled({
        reason,
        category,
        files: selectedFiles,
      });

      setReason('');
      setCategory('quality');
      setSelectedFiles([]);
      setFileError(null);
    } catch (err) {
      console.error('Error filing dispute:', err);
      toast('Failed to file dispute: ' + (err?.message || 'Unknown error'), 'error');
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
          {CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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

      {fileError && (
        <div style={{ ...styles.progress, color: '#b91c1c' }}>
          {fileError}
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
    background: 'rgba(217, 79, 79, 0.08)',
    border: '1px solid rgba(217, 79, 79, 0.28)',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-2)',
  },
  input: {
    padding: '10px',
    background: 'var(--bg-soft)',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  textarea: {
    padding: '10px',
    background: 'var(--bg-soft)',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)',
    borderRadius: '8px',
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
    background: 'var(--surface-2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
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
    background: 'rgba(8, 12, 20, 0.42)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
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
    color: 'var(--text-2)',
    padding: '8px',
    background: 'rgba(8, 12, 20, 0.42)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    background: 'var(--surface-2)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1,
    padding: '10px',
    background: 'var(--red-dim)',
    color: '#fca5a5',
    border: '1px solid var(--red-border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },
};
