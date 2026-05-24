import React from 'react';
import { getInitialsFromName } from '../lib/specialists';

const SpecialistAvatar = ({ name, avatarUrl, size = 'md', className = '' }) => {
  const initials = getInitialsFromName(name);
  const sizeClass = size === 'lg' ? 'specialist-avatar-lg' : 'specialist-avatar';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `${name} profile` : 'Specialist profile'}
        className={`${sizeClass} specialist-avatar-img ${className}`.trim()}
      />
    );
  }

  return (
    <div className={`${sizeClass} ${className}`.trim()} aria-hidden="true">
      {initials}
    </div>
  );
};

export default SpecialistAvatar;
