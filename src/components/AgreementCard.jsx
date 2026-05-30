import React, { useState } from 'react';
import './AgreementCard.css';

export default function AgreementCard({ agreement, isEditing, onUpdate, loading }) {
  const [editValues, setEditValues] = useState({
    expected_delivery_date: agreement?.expected_delivery_date || '',
  });

  if (!agreement) {
    return null;
  }

  const handleSave = async () => {
    try {
      await onUpdate(editValues);
    } catch (err) {
      console.error('Failed to update agreement:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
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

  return (
    <div className="agreement-card">
      <div className="agreement-header">
        <div className="agreement-title">📋 Contract Agreement</div>
        <div className="agreement-id">ID: {agreement.id.substring(0, 8).toUpperCase()}</div>
      </div>

      <div className="agreement-body">
        {/* Agreed Amount */}
        <div className="agreement-row">
          <div className="agreement-label">Agreed Amount</div>
          <div className="agreement-value amount-value">
            {formatCurrency(agreement.agreed_amount)}
          </div>
        </div>

        {/* Proposal Note */}
        {agreement.proposal_note && (
          <div className="agreement-row">
            <div className="agreement-label">Proposal Note</div>
            <div className="agreement-value note-value">{agreement.proposal_note}</div>
          </div>
        )}

        {/* Expected Delivery Date */}
        <div className="agreement-row">
          <div className="agreement-label">Expected Delivery</div>
          {isEditing ? (
            <input
              type="date"
              value={editValues.expected_delivery_date}
              onChange={(e) =>
                setEditValues({
                  ...editValues,
                  expected_delivery_date: e.target.value,
                })
              }
              className="agreement-input"
              disabled={loading}
            />
          ) : (
            <div className="agreement-value">
              {formatDate(agreement.expected_delivery_date)}
            </div>
          )}
        </div>

        {/* Accepted Date */}
        <div className="agreement-row">
          <div className="agreement-label">Accepted On</div>
          <div className="agreement-value">
            {formatDate(agreement.accepted_at)}
          </div>
        </div>

        {/* Status */}
        <div className="agreement-row">
          <div className="agreement-label">Status</div>
          <div className="agreement-value status-active">✓ Active</div>
        </div>
      </div>

      {/* Edit Button */}
      {isEditing && (
        <div className="agreement-footer">
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-save"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
