import React, { useState } from 'react';

export default function ScheduleAppointment({
  isSpecialist,
  onPropose,
  onConfirm,
  onCounterPropose,
  appointment,
  loading,
}) {
  const [showForm, setShowForm] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (appointment && appointment.status === 'rescheduled') {
        await onCounterPropose(appointment.id, proposedDate);
      } else {
        await onPropose(proposedDate, address, notes);
      }
      setProposedDate('');
      setAddress('');
      setNotes('');
      setShowForm(false);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().slice(0, 16);
    } catch {
      return dateStr;
    }
  };

  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const appointmentDate = new Date(dateStr);
    const today = new Date();
    const diff = Math.ceil((appointmentDate - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (!appointment && !isSpecialist) {
    return null;
  }

  if (appointment && appointment.status === 'confirmed') {
    const days = daysUntil(appointment.confirmed_date);
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h4 style={styles.title}>📅 Appointment Scheduled</h4>
          {days !== null && (
            <span style={styles.countdown}>
              {days > 0 ? `${days} days away` : days === 0 ? 'Today!' : 'Past'}
            </span>
          )}
        </div>
        <div style={styles.details}>
          <div style={styles.row}>
            <span style={styles.label}>Date & Time:</span>
            <span style={styles.value}>
              {new Date(appointment.confirmed_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {appointment.service_address && (
            <div style={styles.row}>
              <span style={styles.label}>Location:</span>
              <span style={styles.value}>{appointment.service_address}</span>
            </div>
          )}
          {appointment.notes && (
            <div style={styles.row}>
              <span style={styles.label}>Notes:</span>
              <span style={styles.value}>{appointment.notes}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (appointment && appointment.status === 'pending') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h4 style={styles.title}>⏳ Appointment Pending</h4>
          <span style={styles.status}>Awaiting confirmation</span>
        </div>
        <div style={styles.details}>
          <div style={styles.row}>
            <span style={styles.label}>Proposed Date:</span>
            <span style={styles.value}>
              {new Date(appointment.proposed_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {appointment.service_address && (
            <div style={styles.row}>
              <span style={styles.label}>Location:</span>
              <span style={styles.value}>{appointment.service_address}</span>
            </div>
          )}
        </div>
        {!isSpecialist && (
          <div style={styles.actions}>
            <button
              onClick={() => onConfirm(appointment.id)}
              disabled={loading}
              style={styles.confirmBtn}
            >
              ✓ Confirm
            </button>
            <button
              onClick={() => setShowForm(true)}
              disabled={loading}
              style={styles.counterBtn}
            >
              📝 Counter Propose
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isSpecialist && !appointment) {
    return (
      <div style={styles.container}>
        {!showForm ? (
          <button onClick={() => setShowForm(true)} style={styles.proposeBtn}>
            📅 Propose Visit Date
          </button>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Proposed Date & Time *</label>
              <input
                type="datetime-local"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                required
                style={styles.input}
                disabled={loading}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Service Address *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., Downtown, Tala Street"
                required
                style={styles.input}
                disabled={loading}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details..."
                style={styles.textarea}
                disabled={loading}
              />
            </div>

            <div style={styles.buttons}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={loading}
                style={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !proposedDate || !address}
                style={styles.submitBtn}
              >
                {loading ? 'Proposing...' : 'Propose'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return null;
}

const styles = {
  container: {
    background: 'white',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '600',
  },
  countdown: {
    fontSize: '12px',
    fontWeight: '600',
    background: '#dbeafe',
    color: '#1e40af',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  status: {
    fontSize: '12px',
    fontWeight: '600',
    background: '#fef3c7',
    color: '#92400e',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  label: {
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  value: {
    color: 'var(--text)',
    fontWeight: '500',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  confirmBtn: {
    flex: 1,
    padding: '10px',
    background: 'var(--green)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  counterBtn: {
    flex: 1,
    padding: '10px',
    background: 'white',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  proposeBtn: {
    width: '100%',
    padding: '12px',
    background: 'var(--blue)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  input: {
    padding: '10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  textarea: {
    padding: '10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'inherit',
    minHeight: '80px',
    resize: 'vertical',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    background: 'white',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1,
    padding: '10px',
    background: 'var(--blue)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
