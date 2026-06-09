import React from 'react';

export default function PaymentBetaNotice({ compact = false }) {
  return (
    <div className={`payment-beta-notice ${compact ? 'compact' : ''}`} role="note">
      <strong>Beta payment policy</strong>
      <span>
        CatchUp records the agreed amount and completion state, but does not hold funds during beta.
        Clients and specialists arrange payment directly until the local payment integration is approved.
      </span>
    </div>
  );
}
