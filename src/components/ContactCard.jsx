import React, { useState } from 'react';
import './ContactCard.css';

export default function ContactCard({
  contact = null,
  isRevealed = false,
  onReveal = null,
  loading = false,
  compact = false,
}) {
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleWhatsAppClick = () => {
    if (contact?.whatsapp) {
      const phone = contact.whatsapp.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}`, '_blank');
    } else if (contact?.phone) {
      const phone = contact.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}`, '_blank');
    }
  };

  const handleCall = () => {
    if (contact?.phone) {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  const handleEmail = () => {
    if (contact?.email) {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  if (!isRevealed && !loading) {
    return (
      <div className="contact-card contact-locked">
        <div className="contact-lock-icon">🔒</div>
        <div className="contact-lock-content">
          <h3 className="contact-lock-title">Contact Details Locked</h3>
          <p className="contact-lock-text">
            Accept the bid to unlock contact information
          </p>
        </div>
        {onReveal && (
          <button className="contact-reveal-btn" onClick={onReveal}>
            Reveal Contact
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="contact-card contact-loading">
        <div>Loading contact details...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="contact-card contact-empty">
        <p>Contact information unavailable</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="contact-card compact">
        <div className="contact-header">
          {contact.avatar_url && (
            <img
              src={contact.avatar_url}
              alt={contact.full_name}
              className="contact-avatar"
            />
          )}
          <div className="contact-name">{contact.full_name}</div>
        </div>

        <div className="contact-actions-compact">
          {contact.phone && (
            <button
              className="contact-action-btn phone"
              onClick={handleCall}
              title="Call"
            >
              ☎️
            </button>
          )}
          {(contact.whatsapp || contact.phone) && (
            <button
              className="contact-action-btn whatsapp"
              onClick={handleWhatsAppClick}
              title="WhatsApp"
            >
              💬
            </button>
          )}
          {contact.email && (
            <button
              className="contact-action-btn email"
              onClick={handleEmail}
              title="Email"
            >
              ✉️
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="contact-card contact-revealed">
      {/* Header with Avatar and Name */}
      <div className="contact-header-full">
        {contact.avatar_url && (
          <img
            src={contact.avatar_url}
            alt={contact.full_name}
            className="contact-avatar-large"
          />
        )}
        <div className="contact-name-section">
          <h3 className="contact-name-large">{contact.full_name}</h3>
          <p className="contact-subtitle">Contact Information</p>
        </div>
      </div>

      {/* Contact Details */}
      <div className="contact-details">
        {contact.phone && (
          <div className="contact-detail-item">
            <div className="contact-detail-label">
              <span className="contact-detail-icon">📱</span>
              Phone
            </div>
            <div className="contact-detail-value">
              <span>{contact.phone}</span>
              <button
                className="contact-copy-btn"
                onClick={() => handleCopy(contact.phone, 'phone')}
                title="Copy phone number"
              >
                {copied === 'phone' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button
              className="contact-action-link"
              onClick={handleCall}
            >
              → Call
            </button>
          </div>
        )}

        {contact.email && (
          <div className="contact-detail-item">
            <div className="contact-detail-label">
              <span className="contact-detail-icon">📧</span>
              Email
            </div>
            <div className="contact-detail-value">
              <span className="contact-email">{contact.email}</span>
              <button
                className="contact-copy-btn"
                onClick={() => handleCopy(contact.email, 'email')}
                title="Copy email"
              >
                {copied === 'email' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button
              className="contact-action-link"
              onClick={handleEmail}
            >
              → Email
            </button>
          </div>
        )}

        {(contact.whatsapp || contact.phone) && (
          <div className="contact-detail-item">
            <div className="contact-detail-label">
              <span className="contact-detail-icon">💬</span>
              WhatsApp
            </div>
            <div className="contact-detail-value">
              <span>{contact.whatsapp || contact.phone}</span>
              <button
                className="contact-copy-btn"
                onClick={() => handleCopy(contact.whatsapp || contact.phone, 'whatsapp')}
                title="Copy WhatsApp number"
              >
                {copied === 'whatsapp' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <button
              className="contact-action-link whatsapp-link"
              onClick={handleWhatsAppClick}
            >
              → Open WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="contact-actions">
        {contact.phone && (
          <button className="contact-primary-btn phone-btn" onClick={handleCall}>
            ☎️ Call
          </button>
        )}
        {(contact.whatsapp || contact.phone) && (
          <button className="contact-primary-btn whatsapp-btn" onClick={handleWhatsAppClick}>
            💬 WhatsApp
          </button>
        )}
        {contact.email && (
          <button className="contact-primary-btn email-btn" onClick={handleEmail}>
            ✉️ Email
          </button>
        )}
      </div>

      <p className="contact-note">
        💡 Pro tip: Save this information for future reference
      </p>
    </div>
  );
}
