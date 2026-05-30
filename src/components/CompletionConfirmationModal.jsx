import React, { useState } from 'react';

export default function CompletionConfirmationModal({
  isOpen,
  onClose,
  completion,
  isClient,
  onConfirmCompleted,
  loading,
}) {
  const [message, setMessage] = useState('');

  if (!isOpen || !completion) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onConfirmCompleted(message);
      setMessage('');
      onClose();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const canConfirm = isClient && completion.workDeliveredAt && !completion.confirmedByClientAt;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.title}>Work Status</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.content}>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Specialist Delivered</span>
            <span style={completion.workDeliveredAt ? styles.statusDone : styles.statusPending}>
              {completion.workDeliveredAt ? `✓ ${formatDate(completion.workDeliveredAt)}` : 'Pending'}
            </span>
          </div>

          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Client Confirmed</span>
            <span style={completion.confirmedByClientAt ? styles.statusDone : styles.statusPending}>
              {completion.confirmedByClientAt ? `✓ ${formatDate(completion.confirmedByClientAt)}` : 'Pending'}
            </span>
          </div>

          {canConfirm && (
            <form onSubmit={handleSubmit} style={styles.form}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional satisfaction note (e.g., 'Work looks great!')"
                style={styles.textarea}
                maxLength={500}
              />
              <div style={styles.buttons}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={styles.submitBtn}
                >
                  {loading ? 'Confirming...' : 'Confirm Work Complete'}
                </button>
              </div>
            </form>
          )}

          {!canConfirm && completion.confirmedByClientAt && (
            <div style={styles.successMessage}>
              ✓ Work has been confirmed as complete. You can now leave a review and download the receipt.
            </div>
          )}

          {!canConfirm && !completion.workDeliveredAt && (
            <div style={styles.infoMessage}>
              Waiting for the specialist to mark work as delivered...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    maxWidth: '400px',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0',
  },
  content: {
    padding: '20px',
  },
  statusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    marginBottom: '12px',
    background: '#f9fafb',
    borderRadius: '6px',
  },
  statusLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#666',
  },
  statusDone: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#22c55e',
  },
  statusPending: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#999',
  },
  form: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  textarea: {
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '13px',
    resize: 'vertical',
    minHeight: '80px',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    background: 'white',
    color: '#666',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1,
    padding: '10px',
    background: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  successMessage: {
    marginTop: '16px',
    padding: '12px',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#166534',
  },
  infoMessage: {
    marginTop: '16px',
    padding: '12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#1e40af',
  },
};
