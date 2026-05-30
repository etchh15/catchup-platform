import React from 'react';
import './SpecialistReputationCard.css';

export default function SpecialistReputationCard({
  reputation = {},
  compact = false,
  showDetails = true,
  clickable = false,
  loading = false,
  onClick = null,
}) {
  if (loading || !reputation) {
    return (
      <div className={`reputation-card loading${clickable ? ' clickable' : ''}`}>
        <div className="reputation-loading">Loading reputation…</div>
      </div>
    );
  }

  const {
    average_rating = 0,
    total_reviews = 0,
    total_completed_jobs = 0,
    is_verified = false,
    response_time_hours = 0,
    service_categories = [],
    service_areas = [],
    profile_completeness = 0,
  } = reputation;

  // Format rating with stars
  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <span className="reputation-stars">
        {'⭐'.repeat(fullStars)}
        {hasHalfStar && '⭐'}
        {'☆'.repeat(Math.max(0, emptyStars))}
      </span>
    );
  };

  // Format response time nicely
  const formatResponseTime = (hours) => {
    if (hours === 0) return '—';
    if (hours < 1) return '< 1 hour';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (compact) {
    return (
      <div
        className={`reputation-card compact${clickable ? ' clickable' : ''}`}
        onClick={onClick}
      >
        <div className="reputation-inline">
          <span className="reputation-rating">
            {average_rating > 0 ? `${average_rating.toFixed(1)}⭐` : 'No rating'}
          </span>
          {is_verified && <span className="reputation-badge">✓ Verified</span>}
          <span className="reputation-jobs">{total_completed_jobs} jobs</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`reputation-card${clickable ? ' clickable' : ''}`}
      onClick={onClick}
    >
      {/* Top Section: Rating & Verification */}
      <div className="reputation-top">
        <div className="reputation-rating-section">
          <div className="reputation-stars-large">
            {renderStars(average_rating)}
          </div>
          <div className="reputation-rating-text">
            <span className="reputation-rating-number">
              {average_rating > 0 ? average_rating.toFixed(1) : '0.0'}
            </span>
            <span className="reputation-rating-count">
              {total_reviews > 0 ? `(${total_reviews} reviews)` : 'No reviews yet'}
            </span>
          </div>
        </div>

        {is_verified && (
          <div className="reputation-verified-badge">
            <span className="reputation-verified-icon">✓</span>
            <span className="reputation-verified-text">Verified</span>
          </div>
        )}
      </div>

      {/* Middle Section: Stats */}
      <div className="reputation-stats">
        <div className="reputation-stat">
          <div className="reputation-stat-icon">✓</div>
          <div className="reputation-stat-content">
            <div className="reputation-stat-label">Completed Jobs</div>
            <div className="reputation-stat-value">{total_completed_jobs}</div>
          </div>
        </div>

        <div className="reputation-stat">
          <div className="reputation-stat-icon">⚡</div>
          <div className="reputation-stat-content">
            <div className="reputation-stat-label">Response Time</div>
            <div className="reputation-stat-value">{formatResponseTime(response_time_hours)} avg</div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Categories & Areas */}
      {showDetails && (
        <div className="reputation-details">
          {service_categories && service_categories.length > 0 && (
            <div className="reputation-detail-item">
              <div className="reputation-detail-label">Categories:</div>
              <div className="reputation-detail-tags">
                {service_categories.slice(0, 3).map((cat, i) => (
                  <span key={i} className="reputation-tag">
                    {cat}
                  </span>
                ))}
                {service_categories.length > 3 && (
                  <span className="reputation-tag more">
                    +{service_categories.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {service_areas && service_areas.length > 0 && (
            <div className="reputation-detail-item">
              <div className="reputation-detail-label">Service Areas:</div>
              <div className="reputation-detail-tags">
                {service_areas.slice(0, 3).map((area, i) => (
                  <span key={i} className="reputation-tag area">
                    {area}
                  </span>
                ))}
                {service_areas.length > 3 && (
                  <span className="reputation-tag more">
                    +{service_areas.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {profile_completeness > 0 && (
            <div className="reputation-detail-item">
              <div className="reputation-detail-label">Profile Completeness</div>
              <div className="reputation-progress-bar">
                <div
                  className="reputation-progress-fill"
                  style={{
                    width: `${Math.min(100, profile_completeness)}%`,
                    backgroundColor:
                      profile_completeness >= 80
                        ? '#10b981'
                        : profile_completeness >= 50
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                />
              </div>
              <div className="reputation-progress-text">{profile_completeness}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
