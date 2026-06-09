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
    background: 'rgba(3, 7, 18, 0.72)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.98), rgba(13, 18, 32, 0.98))',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.38)',
    maxWidth: '440px',
    width: 'calc(100% - 32px)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '800',
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'var(--surface-2)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px 8px',
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
    background: 'rgba(8, 12, 20, 0.42)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
  },
  statusLabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-2)',
  },
  statusDone: {
    fontSize: '13px',
    fontWeight: '800',
    color: 'var(--green)',
  },
  statusPending: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-3)',
  },
  form: {
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  textarea: {
    padding: '10px',
    background: 'var(--bg-soft)',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)',
    borderRadius: '8px',
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
    background: 'var(--surface-2)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1,
    padding: '10px',
    background: 'rgba(28,169,126,0.88)',
    color: '#d1fae5',
    border: '1px solid var(--green-border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
  },
  successMessage: {
    marginTop: '16px',
    padding: '12px',
    background: 'var(--green-dim)',
    border: '1px solid var(--green-border)',
    borderRadius: '10px',
    fontSize: '13px',
    color: '#a7f3d0',
  },
  infoMessage: {
    marginTop: '16px',
    padding: '12px',
    background: 'var(--blue-dim)',
    border: '1px solid var(--blue-border)',
    borderRadius: '10px',
    fontSize: '13px',
    color: '#bfdbfe',
  },
};
