import React from 'react';

export default function ReceiptPDF({ agreement, task, completion, review, dispute, onDownload, loading }) {
  if (!agreement || !task) {
    return null;
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
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

  return (
    <div id="receipt-pdf" style={styles.receipt}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>🔧 CatchUp</div>
        <div style={styles.headerInfo}>
          <div style={styles.title}>SERVICE AGREEMENT RECEIPT</div>
          <div style={styles.receiptId}>ID: {agreement.id.substring(0, 8).toUpperCase()}</div>
          <div style={styles.date}>Generated: {formatDate(new Date().toISOString())}</div>
        </div>
      </div>

      {/* Parties */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Service Parties</h3>
        <div style={styles.parties}>
          <div style={styles.party}>
            <div style={styles.partyLabel}>Client</div>
            <div style={styles.partyName}>{task.client_name || 'Client'}</div>
          </div>
          <div style={styles.party}>
            <div style={styles.partyLabel}>Service Provider</div>
            <div style={styles.partyName}>{task.specialist_id || 'Specialist'}</div>
          </div>
        </div>
      </div>

      {/* Job Details */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Service Details</h3>
        <table style={styles.table}>
          <tbody>
            <tr style={styles.tableRow}>
              <td style={styles.tableLabel}>Service Title</td>
              <td style={styles.tableValue}>{task.title}</td>
            </tr>
            <tr style={styles.tableRow}>
              <td style={styles.tableLabel}>Category</td>
              <td style={styles.tableValue}>{task.category || '—'}</td>
            </tr>
            <tr style={styles.tableRow}>
              <td style={styles.tableLabel}>Description</td>
              <td style={styles.tableValue}>{task.description}</td>
            </tr>
            <tr style={styles.tableRow}>
              <td style={styles.tableLabel}>Location</td>
              <td style={styles.tableValue}>{task.district_tag || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Agreement Terms */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Agreement Terms</h3>
        <table style={styles.table}>
          <tbody>
            <tr style={styles.tableRow}>
              <td style={styles.tableLabel}>Agreed Amount</td>
              <td style={{ ...styles.tableValue, fontWeight: 'bold', color: '#22c55e' }}>
                {formatCurrency(agreement.agreed_amount)}
              </td>
            </tr>
            <tr style={styles.tableRow}>
              <td style={styles.tableLabel}>Agreed On</td>
              <td style={styles.tableValue}>{formatDate(agreement.accepted_at)}</td>
            </tr>
            <tr style={styles.tableRow}>
              <td style={styles.tableLabel}>Expected Delivery</td>
              <td style={styles.tableValue}>{formatDate(agreement.expected_delivery_date)}</td>
            </tr>
            {agreement.proposal_note && (
              <tr style={styles.tableRow}>
                <td style={styles.tableLabel}>Proposal Note</td>
                <td style={styles.tableValue}>{agreement.proposal_note}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Execution */}
      {completion && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Execution Timeline</h3>
          <table style={styles.table}>
            <tbody>
              {completion.workDeliveredAt && (
                <tr style={styles.tableRow}>
                  <td style={styles.tableLabel}>Work Delivered</td>
                  <td style={styles.tableValue}>{formatDate(completion.workDeliveredAt)}</td>
                </tr>
              )}
              {completion.confirmedByClientAt && (
                <tr style={styles.tableRow}>
                  <td style={styles.tableLabel}>Confirmed Complete</td>
                  <td style={styles.tableValue}>{formatDate(completion.confirmedByClientAt)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Review */}
      {review && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Quality Review</h3>
          <table style={styles.table}>
            <tbody>
              <tr style={styles.tableRow}>
                <td style={styles.tableLabel}>Rating</td>
                <td style={styles.tableValue}>{'⭐'.repeat(review.rating_score)} ({review.rating_score}/5)</td>
              </tr>
              {review.feedback_text && (
                <tr style={styles.tableRow}>
                  <td style={styles.tableLabel}>Feedback</td>
                  <td style={styles.tableValue}>{review.feedback_text}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Dispute Status */}
      {dispute && (
        <div style={{ ...styles.section, backgroundColor: '#fef2f2', border: '2px solid #fecaca' }}>
          <h3 style={styles.sectionTitle}>Dispute Status</h3>
          <table style={styles.table}>
            <tbody>
              <tr style={styles.tableRow}>
                <td style={styles.tableLabel}>Status</td>
                <td style={styles.tableValue}>{dispute.status.toUpperCase()}</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableLabel}>Reason</td>
                <td style={styles.tableValue}>{dispute.reason}</td>
              </tr>
              <tr style={styles.tableRow}>
                <td style={styles.tableLabel}>Filed On</td>
                <td style={styles.tableValue}>{formatDate(dispute.created_at)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <p>This receipt serves as an official record of the service agreement between both parties.</p>
        <p>CatchUp Platform • Trusted Marketplace for Local Services</p>
        <p style={styles.footerSmall}>For support, visit: support@catchup.com</p>
      </div>

      {/* Download Button */}
      <div style={styles.downloadSection}>
        <button onClick={onDownload} disabled={loading} style={styles.downloadBtn}>
          {loading ? '⏳ Generating PDF...' : '📥 Download Receipt'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  receipt: {
    background: 'white',
    padding: '40px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    color: '#333',
    lineHeight: '1.6',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    paddingBottom: '20px',
    borderBottom: '3px solid #0064c8',
  },
  logo: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#0064c8',
  },
  headerInfo: {
    textAlign: 'right',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  receiptId: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#666',
  },
  date: {
    fontSize: '11px',
    color: '#999',
    marginTop: '4px',
  },
  section: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#0064c8',
  },
  parties: {
    display: 'flex',
    gap: '40px',
  },
  party: {
    flex: 1,
  },
  partyLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#666',
    marginBottom: '4px',
  },
  partyName: {
    fontSize: '14px',
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableRow: {
    borderBottom: '1px solid #e5e7eb',
  },
  tableLabel: {
    width: '35%',
    padding: '8px 0',
    fontWeight: 'bold',
    color: '#666',
  },
  tableValue: {
    padding: '8px 0',
    paddingLeft: '20px',
  },
  footer: {
    marginTop: '40px',
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
    fontSize: '11px',
    color: '#666',
  },
  footerSmall: {
    fontSize: '10px',
    color: '#999',
    marginTop: '8px',
  },
  downloadSection: {
    marginTop: '30px',
    textAlign: 'center',
  },
  downloadBtn: {
    padding: '12px 24px',
    background: '#0064c8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
