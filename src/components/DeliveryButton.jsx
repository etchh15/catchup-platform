import React, { useState } from 'react';

export default function DeliveryButton({ isSpecialist, hasDelivered, onMarkDelivered, loading, disabled }) {
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');

  if (!isSpecialist || hasDelivered) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onMarkDelivered(message);
      setMessage('');
      setShowMessage(false);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  if (showMessage) {
    return (
      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional message to client (e.g., 'Work is complete, please inspect')"
          style={styles.textarea}
          maxLength={500}
        />
        <div style={styles.buttons}>
          <button
            type="button"
            onClick={() => setShowMessage(false)}
            style={styles.cancelBtn}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={styles.submitBtn}
          >
            {loading ? 'Submitting...' : 'Mark Delivered'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      onClick={() => setShowMessage(true)}
      disabled={disabled || loading}
      style={styles.deliveryBtn}
    >
      ✓ Mark Work Delivered
    </button>
  );
}

const styles = {
  deliveryBtn: {
    padding: '10px 16px',
    background: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '12px',
    transition: 'all 0.2s',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '12px',
    padding: '12px',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '6px',
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
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 12px',
    background: 'white',
    color: '#666',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '8px 16px',
    background: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
