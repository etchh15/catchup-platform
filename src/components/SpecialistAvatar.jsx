import React from 'react';
import { getInitialsFromName } from '../lib/specialists';

const SpecialistAvatar = ({ name, avatarUrl, size = 'md', className = '' }) => {
  const initials = getInitialsFromName(name);
  const numericSize = typeof size === 'number' ? size : null;
  const sizeClass = numericSize ? 'specialist-avatar' : size === 'lg' ? 'specialist-avatar-lg' : 'specialist-avatar';
  const sizeStyle = numericSize
    ? { width: numericSize, height: numericSize, fontSize: Math.max(14, Math.round(numericSize * 0.34)) }
    : undefined;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `${name} profile` : 'Specialist profile'}
        className={`${sizeClass} specialist-avatar-img ${className}`.trim()}
        style={sizeStyle}
      />
    );
  }

  return (
    <div className={`${sizeClass} ${className}`.trim()} style={sizeStyle} aria-hidden="true">
      {initials}
    </div>
  );
};

export default SpecialistAvatar;
