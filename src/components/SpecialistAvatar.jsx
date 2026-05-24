import React from 'react';
import { getInitialsFromName } from '../lib/specialists';

const SpecialistAvatar = ({ name, avatarUrl, size = 'md', className = '', isVerified = false }) => {
  const initials = getInitialsFromName(name);
  const sizeClass = size === 'lg' ? 'specialist-avatar-lg' : 'specialist-avatar';

  return (
    <div className={`avatar-wrapper ${className}`.trim()} style={{ display: 'inline-block', position: 'relative' }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name ? `${name} profile` : 'Specialist profile'}
          className={`${sizeClass} specialist-avatar-img`.trim()}
        />
      ) : (
        <div className={`${sizeClass}`.trim()} aria-hidden="true">
          {initials}
        </div>
      )}

      {isVerified && (
        <span className="specialist-verified-badge avatar-badge-position" aria-hidden="true">Verified</span>
      )}
    </div>
  );
};

export default SpecialistAvatar;
