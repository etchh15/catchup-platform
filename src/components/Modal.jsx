import React from 'react';

export function Modal({ isOpen, onClose, title, children, actions }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        className="premium-card"
        style={{
          maxWidth: '500px',
          width: '100%',
          padding: '32px',
          background: 'var(--bg-soft)',
          border: '1px solid #334155',
        }}
      >
        {title && (
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text)' }}>
            {title}
          </h2>
        )}

        <div style={{ margin: '0 0 24px 0', color: 'var(--text-2)', fontSize: '14px' }}>
          {children}
        </div>

        {actions && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                style={{
                  background: action.primary ? 'var(--green)' : 'none',
                  border: action.primary ? 'none' : 'none',
                  color: action.primary ? '#ffffff' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: action.primary ? '600' : '500',
                  padding: action.primary ? '12px 24px' : '0',
                  borderRadius: action.primary ? '8px' : '0',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
