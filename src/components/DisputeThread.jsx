import React, { useState } from 'react';

export default function DisputeThread({ dispute, responses, currentUserId, onRespond, loading }) {
  const [replyMessage, setReplyMessage] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);

  if (!dispute) {
    return null;
  }

  const formatDate = (dateStr) => {
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

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    try {
      await onRespond(replyMessage);
      setReplyMessage('');
      setShowReplyForm(false);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const CATEGORY_LABELS = {
    quality: '⭐ Quality Issue',
    no_show: '❌ No Show',
    incomplete: '📋 Incomplete Work',
    other: '⚠️ Other',
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>Dispute: {CATEGORY_LABELS[dispute.reason_category] || dispute.reason_category}</h4>
        <span style={styles.status}>Status: {dispute.status}</span>
      </div>

      <div style={styles.thread}>
        {/* Original Dispute */}
        <div style={styles.message}>
          <div style={styles.messageMeta}>
            <span style={styles.author}>Dispute Filed</span>
            <span style={styles.time}>{formatDate(dispute.created_at)}</span>
          </div>
          <p style={styles.messageText}>{dispute.reason}</p>

          {dispute.evidence && dispute.evidence.length > 0 && (
            <div style={styles.evidence}>
              <span style={styles.evidenceLabel}>Evidence:</span>
              <div style={styles.imageGrid}>
                {dispute.evidence.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.imageLink}
                  >
                    <img src={item.url} alt={`Evidence ${i + 1}`} style={styles.image} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Responses */}
        {responses.map((response) => (
          <div key={response.id} style={styles.message}>
            <div style={styles.messageMeta}>
              <span style={styles.author}>Response</span>
              <span style={styles.time}>{formatDate(response.created_at)}</span>
            </div>
            <p style={styles.messageText}>{response.message}</p>

            {response.evidence && response.evidence.length > 0 && (
              <div style={styles.evidence}>
                <span style={styles.evidenceLabel}>Evidence:</span>
                <div style={styles.imageGrid}>
                  {response.evidence.map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.imageLink}
                    >
                      <img src={item.url} alt={`Evidence ${i + 1}`} style={styles.image} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!showReplyForm && (
        <button
          onClick={() => setShowReplyForm(true)}
          disabled={loading}
          style={styles.replyBtn}
        >
          💬 Add Response
        </button>
      )}

      {showReplyForm && (
        <form onSubmit={handleSubmitReply} style={styles.replyForm}>
          <textarea
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Type your response..."
            maxLength={500}
            style={styles.textarea}
            disabled={loading}
          />
          <div style={styles.buttons}>
            <button
              type="button"
              onClick={() => setShowReplyForm(false)}
              disabled={loading}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !replyMessage.trim()}
              style={styles.submitBtn}
            >
              {loading ? 'Sending...' : 'Send Response'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(217, 79, 79, 0.08)',
    border: '1px solid rgba(217, 79, 79, 0.28)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(8, 12, 20, 0.38)',
    borderBottom: '1px solid rgba(217, 79, 79, 0.18)',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  status: {
    fontSize: '12px',
    background: 'var(--red-dim)',
    color: '#fca5a5',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  thread: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
  },
  message: {
    padding: '12px',
    background: 'rgba(8, 12, 20, 0.42)',
    borderRadius: '10px',
    border: '1px solid var(--border)',
  },
  messageMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  author: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  time: {
    fontSize: '12px',
    color: 'var(--text-3)',
  },
  messageText: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    color: 'var(--text-2)',
    lineHeight: '1.5',
  },
  evidence: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
  },
  evidenceLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-2)',
    display: 'block',
    marginBottom: '8px',
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '8px',
  },
  imageLink: {
    overflow: 'hidden',
    borderRadius: '4px',
    border: '1px solid var(--border)',
  },
  image: {
    width: '100%',
    height: '80px',
    objectFit: 'cover',
    cursor: 'pointer',
  },
  replyBtn: {
    margin: '12px 16px',
    padding: '10px 16px',
    background: 'var(--blue)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  replyForm: {
    padding: '16px',
    background: 'rgba(59, 130, 246, 0.08)',
    borderTop: '1px solid var(--border)',
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
    padding: '8px',
    background: 'var(--surface-2)',
    color: 'var(--text-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1,
    padding: '8px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
