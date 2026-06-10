import React, { useRef, useState } from 'react';
import { validateSpecialistIdentityDocumentFile } from '../services/supabaseService';

export default function IdentitySelection({ onSelectComplete, isLoading }) {
  const fileInputRef = useRef(null);
  const [idDocumentFile, setIdDocumentFile] = useState(null);
  const [error, setError] = useState('');

  const handleSpecialistSubmit = () => {
    try {
      validateSpecialistIdentityDocumentFile(idDocumentFile);
      setError('');
      onSelectComplete('specialist', { idDocumentFile });
    } catch (err) {
      setError(err?.message || 'Upload an ID document before requesting specialist review.');
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    try {
      if (file) validateSpecialistIdentityDocumentFile(file);
      setIdDocumentFile(file);
      setError('');
    } catch (err) {
      setIdDocumentFile(null);
      setError(err?.message || 'Choose a valid ID document.');
      event.target.value = '';
    }
  };

  return (
    <div className="identity-screen">
      <div className="identity-card">
        <div className="identity-brand-mark">⚡</div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          How will you use CatchUp?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 36, lineHeight: 1.6 }}>
          Clients can start right away. Specialists must upload an ID document first so admin can review trust access.
        </p>

        <div className="identity-option-grid">
          <div
            className="identity-option"
            onClick={() => !isLoading && onSelectComplete('client')}
          >
            <div className="icon">💼</div>
            <h4>I want to hire</h4>
            <p>Post jobs and find local specialists</p>
          </div>

          <div
            className="identity-option"
            onClick={() => !isLoading && fileInputRef.current?.click()}
          >
            <div className="icon">🛠️</div>
            <h4>I want to work</h4>
            <p>Upload ID and apply for manual beta review</p>
          </div>
        </div>

        <div className="identity-document-panel">
          <div>
            <strong>Specialist ID document</strong>
            <p>
              Upload a clear Egyptian national ID, passport, or government ID image/PDF. Only the platform admin can open the file.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Specialist ID document"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            disabled={isLoading}
          />
          {idDocumentFile && (
            <span className="identity-document-file">
              {idDocumentFile.name} · {(idDocumentFile.size / (1024 * 1024)).toFixed(1)}MB
            </span>
          )}
          {error && <p className="identity-document-error">{error}</p>}
          <button
            type="button"
            className="btn btn-primary btn-full"
            disabled={isLoading}
            onClick={handleSpecialistSubmit}
          >
            Request specialist review
          </button>
        </div>

        {isLoading && (
          <p style={{ fontSize: 13, color: 'var(--green)', marginTop: 24 }}>Setting up your account...</p>
        )}
      </div>
    </div>
  );
}
