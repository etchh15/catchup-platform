import React, { useMemo, useState } from 'react';

const statusOf = (appointment) => String(appointment?.status || '').toLowerCase();
const fulfillmentOf = (appointment) => String(appointment?.fulfillment_type || 'IN_PERSON').toUpperCase();

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return amount > 0 ? `${amount.toLocaleString()} EGP` : 'Quote based';
};

const formatDateTime = (value) => {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildSlotOptions = () => {
  const slots = [];
  const now = new Date();
  for (let day = 1; day <= 4; day += 1) {
    [10, 13, 16, 19].forEach((hour) => {
      const slot = new Date(now);
      slot.setDate(now.getDate() + day);
      slot.setHours(hour, 0, 0, 0);
      slots.push(slot);
    });
  }
  return slots;
};

export default function ScheduleAppointment({
  isSpecialist,
  onPropose,
  onConfirm,
  onCounterPropose,
  appointment,
  loading,
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customSlot, setCustomSlot] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState(fulfillmentOf(appointment));
  const [durationMinutes, setDurationMinutes] = useState(Number(appointment?.duration_minutes || 60));
  const [address, setAddress] = useState(appointment?.service_address || '');
  const [notes, setNotes] = useState(appointment?.notes || '');
  const [destinationLatitude, setDestinationLatitude] = useState(appointment?.destination_latitude || '');
  const [destinationLongitude, setDestinationLongitude] = useState(appointment?.destination_longitude || '');

  const slots = useMemo(buildSlotOptions, []);
  const activeStatus = statusOf(appointment);
  const startsAt = appointment?.starts_at || appointment?.proposed_date;
  const priceTotal = appointment?.price_total;
  const rateSnapshot = appointment?.rate_snapshot;
  const estimatedTotal = Number(rateSnapshot || 0) > 0
    ? Number(rateSnapshot) * Number(durationMinutes || 60) / 60
    : 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const proposedDate = customSlot || selectedSlot;
    if (!proposedDate) return;

    const options = {
      fulfillmentType,
      durationMinutes,
      destinationLatitude: destinationLatitude === '' ? null : Number(destinationLatitude),
      destinationLongitude: destinationLongitude === '' ? null : Number(destinationLongitude),
    };

    if (appointment && ['pending', 'rescheduled'].includes(activeStatus)) {
      await onCounterPropose(
        appointment.id,
        proposedDate,
        isSpecialist ? 'specialist' : 'client',
        address || appointment.service_address || '',
        notes || appointment.notes || '',
        options
      );
    } else {
      await onPropose(proposedDate, address, notes, options);
    }

    setShowForm(false);
    setSelectedSlot('');
    setCustomSlot('');
  };

  const renderStatusSummary = () => {
    if (!appointment) return null;

    const confirmed = activeStatus === 'confirmed';
    const completed = activeStatus === 'completed';
    const cancelled = activeStatus === 'cancelled';

    return (
      <div style={styles.summary}>
        <div>
          <span style={styles.eyebrow}>
            {confirmed ? 'Confirmed appointment' : completed ? 'Completed appointment' : cancelled ? 'Cancelled appointment' : 'Pending reservation'}
          </span>
          <h4 style={styles.title}>{formatDateTime(startsAt)}</h4>
          <p style={styles.copy}>
            {fulfillmentOf(appointment) === 'ONLINE'
              ? appointment.video_room_url
                ? 'Online room is active and attached to this appointment.'
                : 'Online room will activate after confirmation/payment hold.'
              : appointment.service_address || 'In-person destination will be shared after confirmation.'}
          </p>
        </div>
        <div style={styles.receipt}>
          <span>{appointment.fulfillment_type === 'ONLINE' ? 'Online session' : 'In-person visit'}</span>
          <strong>{formatMoney(priceTotal || estimatedTotal)}</strong>
          <small>{Number(appointment.duration_minutes || durationMinutes)} min</small>
        </div>
      </div>
    );
  };

  const renderForm = (submitLabel = 'Reserve time') => (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.segmented}>
        {['IN_PERSON', 'ONLINE'].map((type) => (
          <button
            type="button"
            key={type}
            onClick={() => setFulfillmentType(type)}
            style={{
              ...styles.segmentButton,
              ...(fulfillmentType === type ? styles.segmentButtonActive : {}),
            }}
          >
            {type === 'ONLINE' ? 'Online session' : 'In-person visit'}
          </button>
        ))}
      </div>

      <div style={styles.slotGrid}>
        {slots.map((slot) => {
          const iso = slot.toISOString();
          const selected = selectedSlot === iso && !customSlot;
          return (
            <button
              type="button"
              key={iso}
              onClick={() => {
                setSelectedSlot(iso);
                setCustomSlot('');
              }}
              style={{ ...styles.slot, ...(selected ? styles.slotActive : {}) }}
            >
              <span>{slot.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <strong>{slot.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong>
            </button>
          );
        })}
      </div>

      <div style={styles.fieldGrid}>
        <label style={styles.field}>
          <span style={styles.label}>Custom time</span>
          <input
            type="datetime-local"
            value={customSlot}
            onChange={(e) => {
              setCustomSlot(e.target.value);
              setSelectedSlot('');
            }}
            style={styles.input}
            disabled={loading}
          />
        </label>
        <label style={styles.field}>
          <span style={styles.label}>Duration</span>
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            style={styles.input}
            disabled={loading}
          >
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
          </select>
        </label>
      </div>

      {fulfillmentType === 'IN_PERSON' && (
        <>
          <label style={styles.field}>
            <span style={styles.label}>Visit address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Building, street, district"
              required
              style={styles.input}
              disabled={loading}
            />
          </label>
          <div style={styles.fieldGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Latitude</span>
              <input
                type="number"
                step="any"
                value={destinationLatitude}
                onChange={(e) => setDestinationLatitude(e.target.value)}
                placeholder="Optional"
                style={styles.input}
                disabled={loading}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Longitude</span>
              <input
                type="number"
                step="any"
                value={destinationLongitude}
                onChange={(e) => setDestinationLongitude(e.target.value)}
                placeholder="Optional"
                style={styles.input}
                disabled={loading}
              />
            </label>
          </div>
        </>
      )}

      <label style={styles.field}>
        <span style={styles.label}>Appointment notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Access details, online goals, tools needed..."
          style={styles.textarea}
          disabled={loading}
        />
      </label>

      <div style={styles.priceBox}>
        <div>
          <span style={styles.eyebrow}>Estimated reservation</span>
          <strong style={styles.price}>{formatMoney(priceTotal || estimatedTotal)}</strong>
        </div>
        <small style={styles.muted}>The final receipt stays attached to the workspace.</small>
      </div>

      <div style={styles.buttons}>
        <button type="button" onClick={() => setShowForm(false)} disabled={loading} style={styles.secondaryButton}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || (!selectedSlot && !customSlot) || (fulfillmentType === 'IN_PERSON' && !address)}
          style={styles.primaryButton}
        >
          {loading ? 'Checking slot...' : submitLabel}
        </button>
      </div>
    </form>
  );

  if (!appointment && !isSpecialist) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Appointment engine</span>
          <h3 style={styles.heading}>Reserve a protected service window</h3>
        </div>
        <span style={styles.statePill}>{appointment ? activeStatus || 'pending' : 'No slot'}</span>
      </div>

      {renderStatusSummary()}

      {appointment?.video_room_url && activeStatus === 'confirmed' && (
        <a href={appointment.video_room_url} target="_blank" rel="noreferrer" style={styles.roomLink}>
          Join secure online room
        </a>
      )}

      {appointment && activeStatus === 'pending' && !showForm && (
        <div style={styles.buttons}>
          <button onClick={() => onConfirm(appointment.id)} disabled={loading} style={styles.primaryButton}>
            Confirm reservation
          </button>
          <button onClick={() => setShowForm(true)} disabled={loading} style={styles.secondaryButton}>
            Suggest another time
          </button>
        </div>
      )}

      {!appointment && isSpecialist && !showForm && (
        <button onClick={() => setShowForm(true)} disabled={loading} style={styles.primaryButtonFull}>
          Propose appointment window
        </button>
      )}

      {showForm && renderForm(appointment ? 'Send new reservation' : 'Reserve appointment')}
    </div>
  );
}

const styles = {
  container: {
    border: '1px solid rgba(148, 163, 184, 0.24)',
    background: 'linear-gradient(145deg, rgba(15,23,42,0.94), rgba(17,34,61,0.9))',
    borderRadius: 18,
    padding: 18,
    color: '#e5eefc',
    boxShadow: '0 20px 60px rgba(2, 6, 23, 0.28)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  eyebrow: {
    display: 'block',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: '#94a3b8',
    fontWeight: 800,
  },
  heading: {
    margin: '4px 0 0',
    fontSize: 19,
    lineHeight: 1.2,
  },
  statePill: {
    border: '1px solid rgba(245, 158, 11, 0.34)',
    background: 'rgba(245, 158, 11, 0.14)',
    color: '#f8c45f',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 14,
    alignItems: 'stretch',
    marginBottom: 14,
  },
  title: {
    margin: '4px 0 6px',
    fontSize: 17,
  },
  copy: {
    margin: 0,
    color: '#9fb0c8',
    lineHeight: 1.5,
  },
  receipt: {
    minWidth: 138,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 14,
    padding: 12,
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  form: {
    display: 'grid',
    gap: 12,
    marginTop: 14,
  },
  segmented: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  segmentButton: {
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(15,23,42,0.82)',
    color: '#cbd5e1',
    borderRadius: 12,
    padding: '11px 12px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  segmentButtonActive: {
    background: '#f8b83e',
    color: '#111827',
    borderColor: '#f8b83e',
  },
  slotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))',
    gap: 8,
  },
  slot: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(255,255,255,0.045)',
    color: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    textAlign: 'left',
    cursor: 'pointer',
  },
  slotActive: {
    borderColor: '#10b981',
    boxShadow: '0 0 0 1px rgba(16,185,129,0.32) inset',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 10,
  },
  field: {
    display: 'grid',
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: '#a8b5c9',
    fontWeight: 800,
  },
  input: {
    width: '100%',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    background: 'rgba(2,6,23,0.46)',
    color: '#f8fafc',
    borderRadius: 12,
    padding: '11px 12px',
    fontSize: 14,
  },
  textarea: {
    width: '100%',
    minHeight: 86,
    border: '1px solid rgba(148, 163, 184, 0.24)',
    background: 'rgba(2,6,23,0.46)',
    color: '#f8fafc',
    borderRadius: 12,
    padding: '11px 12px',
    fontSize: 14,
    resize: 'vertical',
  },
  priceBox: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    border: '1px solid rgba(16, 185, 129, 0.28)',
    background: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 14,
    padding: 12,
  },
  price: {
    display: 'block',
    marginTop: 3,
    color: '#34d399',
    fontSize: 18,
  },
  muted: {
    color: '#9fb0c8',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 0,
    background: '#3b82f6',
    color: '#fff',
    borderRadius: 12,
    padding: '11px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  primaryButtonFull: {
    width: '100%',
    border: 0,
    background: '#3b82f6',
    color: '#fff',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(255,255,255,0.05)',
    color: '#dbeafe',
    borderRadius: 12,
    padding: '11px 16px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  roomLink: {
    display: 'block',
    textAlign: 'center',
    textDecoration: 'none',
    borderRadius: 12,
    padding: '11px 14px',
    background: 'rgba(16, 185, 129, 0.14)',
    color: '#6ee7b7',
    fontWeight: 900,
    marginBottom: 12,
  },
};
