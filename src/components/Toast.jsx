import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const colorMap = {
    success: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', color: '#a7f3d0', icon: '✅' },
    error:   { bg: 'rgba(239,  68,  68, 0.15)', border: '#ef4444', color: '#fca5a5', icon: '⚠️' },
    info:    { bg: 'rgba( 56, 189, 248, 0.15)', border: '#38bdf8', color: '#bae6fd', icon: 'ℹ️' },
    warning: { bg: 'rgba(245, 158,  11, 0.15)', border: '#f59e0b', color: '#fde68a', icon: '⚡' },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        zIndex: 99999, maxWidth: '380px', width: '90vw',
      }}>
        {toasts.map(t => {
          const style = colorMap[t.type] || colorMap.info;
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: style.bg, border: `1px solid ${style.border}`,
              color: style.color, borderRadius: '10px',
              padding: '14px 16px', fontSize: '14px', lineHeight: '1.4',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              animation: 'slideIn 0.2s ease',
            }}>
              <span style={{ flexShrink: 0, marginTop: '1px' }}>{style.icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                style={{ background: 'none', border: 'none', color: style.color,
                  cursor: 'pointer', fontSize: '16px', padding: 0, opacity: 0.7,
                  flexShrink: 0, lineHeight: 1 }}
              >✕</button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.show;
}
