import React, { useState, useOptimistic, useCallback } from 'react';
import { useToast } from './Toast';

export default function DeliveryButton({ isSpecialist, hasDelivered, onMarkDelivered, loading, disabled }) {
  const toast = useToast();
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');

  // Optimistic state: immediately show hasDelivered as true
  const [optimisticDelivered, updateOptimisticDelivered] = useOptimistic(hasDelivered, (state, _action) => true);
  const [delivering, setDelivering] = useState(false);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      
      // 1. Optimistic UI: immediately show as delivered
      updateOptimisticDelivered();
      setDelivering(true);

      try {
        // 2. Send delivery notification in background
        await onMarkDelivered(message);
        setMessage('');
        setShowMessage(false);
        toast('Delivery marked. The client can now confirm completion.', 'success');
      } catch (err) {
        // On error, revert optimistic state
        setDelivering(false);
        console.error('❌ Error marking as delivered:', err);
        toast('Failed to mark as delivered', 'error');
      }
    },
    [message, updateOptimisticDelivered, onMarkDelivered, toast]
  );

  if (!isSpecialist || optimisticDelivered) {
    return null;
  }

  if (showMessage) {
    return (
      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional message to client (e.g., 'Work is complete, please inspect')"
          style={styles.textarea}
          maxLength={500}
          disabled={delivering}
        />
        <div style={styles.buttons}>
          <button
            type="button"
            onClick={() => {
              setShowMessage(false);
              setMessage('');
            }}
            disabled={delivering}
            style={styles.cancelBtn}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || delivering}
            className="workspace-action success"
            style={styles.submitBtn}
          >
            <span>{delivering ? 'Sending' : 'Delivered'}</span>
            <small>{delivering ? 'Please wait' : 'Notify client'}</small>
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      onClick={() => setShowMessage(true)}
      disabled={disabled || loading || delivering}
      className="workspace-action success workspace-delivery-action"
    >
      <span>Mark done</span>
      <small>Notify client</small>
    </button>
  );
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: 0,
    padding: '12px',
    background: 'var(--green-dim)',
    border: '1px solid var(--green-border)',
    borderRadius: '12px',
    gridColumn: '1 / -1',
    width: '100%',
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
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 12px',
    background: 'var(--surface-2)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  submitBtn: {
    minWidth: '132px',
  },
};
