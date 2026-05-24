import React from 'react';

const FeedEmptyState = ({
  icon = '🔍',
  title,
  description,
  resetLabel = 'Reset filters',
  onReset,
  showReset = true,
  variant = 'tasks',
}) => (
  <div className={`feed-empty-state feed-empty-state--${variant}`}>
    <div className="feed-empty-state-icon" aria-hidden="true">
      {icon}
    </div>
    <h3 className="feed-empty-state-title">{title}</h3>
    <p className="feed-empty-state-description">{description}</p>
    {showReset && onReset && (
      <button type="button" className="feed-empty-state-reset" onClick={onReset}>
        {resetLabel}
      </button>
    )}
  </div>
);

export default FeedEmptyState;
