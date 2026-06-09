import React, { useState } from 'react';
import './AgreementSnapshot.css';

export default function AgreementSnapshot({ agreement, isOpen, onClose, onAccept, loading }) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen || !agreement) {
    return null;
  }

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
    }).format(amount);
  };
  const agreementId = agreement.id ? String(agreement.id).substring(0, 8).toUpperCase() : 'PENDING';

  return (
    <div className="agreement-snapshot-overlay">
      <div className="agreement-snapshot-modal">
        <div className="snapshot-header">
          <h2>✓ Agreement Confirmed</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="snapshot-content">
          <p className="snapshot-subtitle">Your contract has been accepted. Here are the details:</p>

          <div className="snapshot-details">
            <div className="detail-row">
              <span className="detail-label">Agreement ID</span>
              <span className="detail-value">{agreementId}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Agreed Amount</span>
              <span className="detail-value amount">{formatCurrency(agreement.agreed_amount)}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Expected Delivery</span>
              <span className="detail-value">{formatDate(agreement.expected_delivery_date)}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Accepted On</span>
              <span className="detail-value">{formatDate(agreement.accepted_at)}</span>
            </div>

            {agreement.proposal_note && (
              <div className="detail-section">
                <span className="detail-label">Proposal Note</span>
                <p className="detail-note">{agreement.proposal_note}</p>
              </div>
            )}
          </div>

          <div className="snapshot-acknowledgment">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span>I acknowledge the terms of this agreement</span>
            </label>
          </div>
        </div>

        <div className="snapshot-footer">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            View Full Details
          </button>
          <button
            className="btn-primary"
            onClick={onAccept}
            disabled={!acknowledged || loading}
          >
            {loading ? 'Processing...' : 'Got It, Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
